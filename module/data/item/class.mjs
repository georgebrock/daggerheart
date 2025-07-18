import BaseDataItem from './base.mjs';
import ForeignDocumentUUIDField from '../fields/foreignDocumentUUIDField.mjs';
import ForeignDocumentUUIDArrayField from '../fields/foreignDocumentUUIDArrayField.mjs';

export default class DHClass extends BaseDataItem {
    /** @inheritDoc */
    static get metadata() {
        return foundry.utils.mergeObject(super.metadata, {
            label: 'TYPES.Item.class',
            type: 'class',
            hasDescription: true
        });
    }

    /** @inheritDoc */
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            ...super.defineSchema(),
            domains: new fields.ArrayField(new fields.StringField(), { max: 2 }),
            classItems: new ForeignDocumentUUIDArrayField({ type: 'Item', required: false }),
            hitPoints: new fields.NumberField({
                required: true,
                integer: true,
                min: 1,
                initial: 5,
                label: 'DAGGERHEART.GENERAL.hitPoints.plural'
            }),
            evasion: new fields.NumberField({ initial: 0, integer: true, label: 'DAGGERHEART.GENERAL.evasion' }),
            features: new ForeignDocumentUUIDArrayField({ type: 'Item' }),
            subclasses: new ForeignDocumentUUIDArrayField({ type: 'Item', required: false }),
            inventory: new fields.SchemaField({
                take: new ForeignDocumentUUIDArrayField({ type: 'Item', required: false }),
                choiceA: new ForeignDocumentUUIDArrayField({ type: 'Item', required: false }),
                choiceB: new ForeignDocumentUUIDArrayField({ type: 'Item', required: false })
            }),
            characterGuide: new fields.SchemaField({
                suggestedTraits: new fields.SchemaField({
                    agility: new fields.NumberField({ initial: 0, integer: true }),
                    strength: new fields.NumberField({ initial: 0, integer: true }),
                    finesse: new fields.NumberField({ initial: 0, integer: true }),
                    instinct: new fields.NumberField({ initial: 0, integer: true }),
                    presence: new fields.NumberField({ initial: 0, integer: true }),
                    knowledge: new fields.NumberField({ initial: 0, integer: true })
                }),
                suggestedPrimaryWeapon: new ForeignDocumentUUIDField({ type: 'Item' }),
                suggestedSecondaryWeapon: new ForeignDocumentUUIDField({ type: 'Item' }),
                suggestedArmor: new ForeignDocumentUUIDField({ type: 'Item' })
            }),
            isMulticlass: new fields.BooleanField({ initial: false })
        };
    }

    get hopeFeatures() {
        return (
            this.features.filter(x => x?.system?.subType === CONFIG.DH.ITEM.featureSubTypes.hope) ??
            (this.features.filter(x => !x).length > 0 ? {} : null)
        );
    }

    get classFeatures() {
        return (
            this.features.filter(x => x?.system?.subType === CONFIG.DH.ITEM.featureSubTypes.class) ??
            (this.features.filter(x => !x).length > 0 ? {} : null)
        );
    }

    async _preCreate(data, options, user) {
        const allowed = await super._preCreate(data, options, user);
        if (allowed === false) return;

        if (this.actor?.type === 'character') {
            const path = data.system.isMulticlass ? 'system.multiclass.value' : 'system.class.value';
            if (foundry.utils.getProperty(this.actor, path)) {
                ui.notifications.error(game.i18n.localize('DAGGERHEART.UI.Notifications.classAlreadySelected'));
                return false;
            }
        }
    }

    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);
        if (options.parent?.type === 'character') {
            const path = `system.${data.system.isMulticlass ? 'multiclass.value' : 'class.value'}`;
            options.parent.update({ [path]: `${options.parent.uuid}.Item.${data._id}` });
        }
    }

    _onDelete(options, userId) {
        super._onDelete(options, userId);

        if (options.parent?.type === 'character') {
            const path = `system.${this.isMulticlass ? 'multiclass' : 'class'}`;
            options.parent.update({
                [`${path}.value`]: null
            });

            foundry.utils.getProperty(options.parent, `${path}.subclass`)?.delete();
        }
    }
}
