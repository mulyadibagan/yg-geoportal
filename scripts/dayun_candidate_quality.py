"""Native crown-centre geometry and explicit staff labels, never a species census.

A rejected location is not automatically a non-pineapple example: duplicate and
misplaced markers can still lie on pineapple leaves. Existing decisions stay
immutable; this module only reads arrays and review snapshots.
"""
import hashlib
import json
import cv2
import numpy as np


def training_examples(review):
    positives, negatives, unclassified = [], [], []
    for feature in (review or {}).get('changes', []):
        p = feature['properties']
        if p.get('status') == 'accepted':
            positives.append(feature)
        elif p.get('status') == 'rejected':
            (negatives if p.get('rejection_reason') == 'not_pineapple' else unclassified).append(feature)
    return {'positive': positives, 'negative': negatives, 'unclassified_rejections': unclassified}


def scaled_radii(radii, source_gsd_m, target_gsd_m):
    source, target = np.asarray(source_gsd_m, float), np.asarray(target_gsd_m, float)
    if source.shape != (2,) or target.shape != (2,) or not np.isfinite([source, target]).all() or min(*source, *target) <= 0:
        raise ValueError('invalid_metric_gsd')
    if max(source)/min(source) > 1.05 or max(target)/min(target) > 1.05:
        raise ValueError('anisotropic_grid_requires_separate_validation')
    if not radii or any(not isinstance(r, int) or r < 3 for r in radii):
        raise ValueError('invalid_native_radii')
    result = sorted({int(round(r * source.mean()/target.mean())) for r in radii})
    if min(result) < 3:
        raise ValueError('target_resolution_too_coarse')
    return result


def angular_descriptor(rgb, valid, radii=(10,14,18,22,28,36,44,56,72)):
    """Require leaf-edge support around a centre, rather than one wood crossing.

    Returns a geometry score, not pineapple probability. Local percentile
    normalization must use the same physical patch extent in train and infer.
    Unknown/occluded annuli return None instead of being treated as background.
    """
    if rgb.ndim != 3 or rgb.shape[2] != 3 or valid.shape != rgb.shape[:2] or not radii or any(r < 3 or int(r) != r for r in radii):
        raise ValueError('invalid_angular_input')
    h,w = valid.shape; cy,cx = h//2,w//2
    if min(cx,cy,w-1-cx,h-1-cy) < max(radii)+2:
        raise ValueError('angular_patch_too_small')
    yy,xx = np.mgrid[:h,:w];xx=xx-cx;yy=yy-cy
    radius=np.hypot(xx,yy);theta=np.arctan2(yy,xx)
    if not valid[radius<=max(radii)].all():return None
    gray=cv2.GaussianBlur(cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY).astype('float32'),(0,0),1)
    gx=cv2.Sobel(gray,cv2.CV_32F,1,0);gy=cv2.Sobel(gray,cv2.CV_32F,0,1);energy=gx*gx+gy*gy
    weight=np.minimum(np.sqrt(energy)/(np.percentile(np.sqrt(energy)[valid],80)+1e-6),1)
    aligned=((gy*gy-gx*gx)*np.cos(2*theta)-2*gx*gy*np.sin(2*theta))/(energy+1e-6)
    sector=np.floor((theta+np.pi)*12/(2*np.pi)).astype(int)%12;rows=[]
    for r in radii:
        ring=(radius>=r*.25)&(radius<=r)
        values=np.array([np.sum(aligned[ring&(sector==s)]*weight[ring&(sector==s)])/(np.sum(weight[ring&(sector==s)])+1e-6) for s in range(12)])
        rows.append({'radius':int(r),'mean':float(values.mean()),'lower_quartile':float(np.quantile(values,.25)),'sector_support':float(np.mean(values>.15))})
    best=max(rows,key=lambda row:row['mean'])
    return {'score':max(0,best['mean'])*best['sector_support']*max(.05,best['lower_quartile']+.25),'best_radius':best['radius'],'scales':rows,'species_probability':None}


def fit_angular_guard(training_descriptors, *, source_run, review_version, radii, gsd_m):
    """Operating point uses training positives only, never holdout/DB totals."""
    if len(training_descriptors)<10 or any(d is None or not np.isfinite(d.get('score', np.nan)) or d['score']<0 for d in training_descriptors):
        raise ValueError('insufficient_valid_training_descriptors')
    scaled_radii(list(radii),gsd_m,gsd_m)
    model={'schema':'dayun-angular-guard-v1','source_run':source_run,'training_review_version':review_version,'threshold':float(np.quantile([d['score'] for d in training_descriptors],.10)),
           'radii_native_pixels':list(radii),'gsd_m':list(gsd_m),'patch_half_native_pixels':112,'threshold_rule':'training_positive_lower_decile','scope':'crown_centre_geometry_trial_not_species_classifier',
           'production_species_validated':False,'validated_pineapple_total':None,'census_changed':False}
    model['signature']=hashlib.sha256(json.dumps(model,sort_keys=True).encode()).hexdigest()
    return model


def filter_proposals(rgb,valid,proposals,model,gsd_m):
    """Optional experimental second stage for the existing radial engine.

    GSD is supplied in metres by the caller; degrees or another source scale
    cannot silently reuse a fitted threshold. No coordinates/scores are moved.
    """
    if model.get('schema')!='dayun-angular-guard-v1' or not np.isfinite(model.get('threshold',np.nan)) or not 0<=model['threshold']<=1.25:
        raise ValueError('invalid_angular_model')
    if gsd_m is None or np.asarray(gsd_m).shape!=(2,) or not np.isfinite(gsd_m).all() or not np.allclose(gsd_m,model['gsd_m'],rtol=1e-6,atol=0):
        raise ValueError('angular_model_gsd_mismatch')
    half=model['patch_half_native_pixels'];h,w=valid.shape;kept=[]
    for proposal in proposals:
        _,x,y=proposal
        if x-half<0 or y-half<0 or x+half>=w or y+half>=h:continue
        desc=angular_descriptor(rgb[y-half:y+half+1,x-half:x+half+1],valid[y-half:y+half+1,x-half:x+half+1],model['radii_native_pixels'])
        if desc is not None and desc['score']>=model['threshold']:kept.append(proposal)
    return kept
