# NinFit medical-purpose boundary

**Status:** launch regulatory boundary draft — prepared 5 September 2026. This is a product-intent record, not a regulator determination or legal opinion.

## Launch intended purpose

NinFit is intended to help adults record general physical activity, build a gentle movement habit, review their own fitness history, and receive non-clinical motivational companion feedback based on that recorded activity.

At launch NinFit is intended for **general fitness and general wellbeing**. It is not intended to diagnose, prevent, predict, monitor, treat or alleviate a disease, injury or medical condition, and it is not intended to recommend or alter clinical treatment.

NinFit may display information a person enters themselves, records during an activity, or derives from ordinary fitness activity. Those values are presented as personal fitness records, not clinical findings.

## What NinFit must not claim at launch

Product UI, onboarding, app-store copy, website copy, support material, advertising and social posts must not claim or imply that NinFit:

- diagnoses a condition or tells a user they have one;
- calculates an individual risk of disease;
- monitors a diagnosed condition for clinical purposes;
- recommends medication, dosage, treatment or other clinical intervention;
- replaces advice from a qualified healthcare professional;
- interprets health measurements as a clinical verdict;
- identifies whether a person is medically safe to exercise;
- provides rehabilitation or treatment for an injury or condition unless a future regulated pathway is deliberately adopted.

A generic disclaimer cannot rescue medical claims made elsewhere. The product boundary therefore lives in the whole intended-purpose record and all public claims, not in a single “not a medical device” sentence.

## Current product behaviours consistent with this boundary

NinFit's launch direction is deliberately non-clinical:

- onboarding recommends a fitness path and explicitly does not diagnose from health notes;
- body/health measurements are presented neutrally rather than scored against population norms;
- Journey records ordinary activity and route history rather than clinical monitoring;
- game rewards follow recorded fitness facts and do not represent health status;
- the companion is motivational presentation, not an authority on the user's health;
- the launch programme focuses on starting or returning to ordinary movement rather than treating a condition.

## Medical-purpose re-review triggers

Re-open this boundary before shipping any feature or public claim that does any of the following:

1. uses symptoms, health measurements or medical history to diagnose or predict a condition;
2. provides individual disease-risk scores;
3. recommends, adjusts or influences clinical treatment;
4. claims to monitor a disease, injury, rehabilitation programme or therapeutic outcome;
5. claims clinical accuracy or clinical effectiveness;
6. turns AI coaching into diagnosis, triage or treatment advice;
7. changes app-store category, marketing or instructions in a way that could objectively imply a medical purpose;
8. introduces a feature linked to a specific medicine or medical device;
9. is promoted to healthcare professionals for clinical decision-making.

If any trigger fires, stop describing the feature under this launch boundary and perform a fresh qualification/classification review before release.

## Evidence basis

MHRA guidance says intended purpose is determined objectively from what the manufacturer supplies in labelling, instructions, promotional materials and technical documentation. It also warns that a general disclaimer does not prevent device status when medical claims are made elsewhere.

The MHRA's software flowchart states that monitoring **general fitness, general health and general wellbeing is not usually considered a medical purpose**, while software is more likely to be a device when it diagnoses/prognoses disease or influences treatment.

Primary guidance reviewed on 5 September 2026:

- MHRA, *Medical devices: software applications*: https://www.gov.uk/government/publications/medical-devices-software-applications-apps
- MHRA, *Crafting an intended purpose in the context of Software as a Medical Device (SaMD)*: https://www.gov.uk/government/publications/crafting-an-intended-purpose-in-the-context-of-software-as-a-medical-device-samd
- MHRA, *Medical devices: software and artificial intelligence (AI)*: https://www.gov.uk/government/publications/software-and-artificial-intelligence-ai-as-a-medical-device
- MHRA, *Borderlines with medical devices and other products in Great Britain*: https://www.gov.uk/government/publications/borderlines-with-medical-devices/borderlines-with-medical-devices-and-other-products-in-great-britain

## Release gate

Before public launch, a human owner must compare this intended-purpose statement with the actual production UI, app-store listing, website, screenshots, support copy and marketing. A mismatch is a release blocker.
