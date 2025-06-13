import ActionField from '../../fields/actionField.mjs';
import ForeignDocumentUUIDField from '../../fields/foreignDocumentUUIDField.mjs';
import PseudoDocument from '../base/pseudoDocument.mjs';

export default class BaseFeatureData extends PseudoDocument {
    static LOCALIZATION_PREFIXES = ['DAGGERHEART.Feature'];

    /**@inheritdoc */
    static get metadata() {
        return foundry.utils.mergeObject(
            super.metadata,
            {
                name: 'feature',
                sheetClass: CONFIG.daggerheart.pseudoDocuments.feature.sheetClass,
                embedded: {}
            },
            { inplace: false }
        );
    }

    static defineSchema() {
        const { fields } = foundry.data;
        const schema = super.defineSchema();
        return Object.assign(schema, {
            subtype: new fields.StringField({ initial: 'test' }),
            actions: new fields.ArrayField(new ActionField()),
            effects: new fields.ArrayField(new ForeignDocumentUUIDField({ type: 'ActiveEffect' }))
        });
    }
}
