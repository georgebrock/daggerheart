import { pseudoDocuments } from '../data/_module.mjs';
import { pseudoDocumentSheet } from '../applications/_module.mjs';

//CONFIG.daggerheart.pseudoDocuments
export default {
    sheetClass: pseudoDocumentSheet.PseudoDocumentSheet,
    feature: {
        label: 'DAGGERHEART.Feature.Label',
        sheetClass: pseudoDocumentSheet.PseudoFeatureSheet,
        documentClass: pseudoDocuments.feature.BaseFeatureData,
        types: {
            item: {
                label: 'DAGGERHEART.Feature.Item.Label',
                documentClass: pseudoDocuments.feature.ItemFeature
            },
            weapon: {
                label: 'DAGGERHEART.Feature.Weapon.Label',
                documentClass: pseudoDocuments.feature.WeaponFeature
            }
        }
    }
};
