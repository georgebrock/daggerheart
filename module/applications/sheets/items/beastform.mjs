import DHBaseItemSheet from '../api/base-item.mjs';
import Tagify from '@yaireo/tagify';

export default class BeastformSheet extends DHBaseItemSheet {
    /**@inheritdoc */
    static DEFAULT_OPTIONS = {
        classes: ['beastform']
    };

    /**@override */
    static PARTS = {
        header: { template: 'systems/daggerheart/templates/sheets/items/beastform/header.hbs' },
        tabs: { template: 'systems/daggerheart/templates/sheets/global/tabs/tab-navigation.hbs' },
        settings: { template: 'systems/daggerheart/templates/sheets/items/beastform/settings.hbs' },
        features: {
            template: 'systems/daggerheart/templates/sheets/global/tabs/tab-features.hbs',
            scrollable: ['.features']
        },
        advanced: { template: 'systems/daggerheart/templates/sheets/items/beastform/advanced.hbs' },
        effects: {
            template: 'systems/daggerheart/templates/sheets/global/tabs/tab-effects.hbs',
            scrollable: ['.effects']
        }
    };

    static TABS = {
        primary: {
            tabs: [{ id: 'settings' }, { id: 'features' }, { id: 'advanced' }, { id: 'effects' }],
            initial: 'settings',
            labelPrefix: 'DAGGERHEART.GENERAL.Tabs'
        }
    };

    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);

        const advantageOnInput = htmlElement.querySelector('.advantageon-input');
        if (advantageOnInput) {
            const tagifyElement = new Tagify(advantageOnInput);
            tagifyElement.on('add', this.advantageOnAdd.bind(this));
            tagifyElement.on('remove', this.advantageOnRemove.bind(this));
        }
    }

    /**@inheritdoc */
    async _prepareContext(_options) {
        const context = await super._prepareContext(_options);

        const data = { ...context.document.toObject() };
        context.document = {
            ...data,
            system: {
                ...data.system,
                features: this.document.system.features
            }
        };
        context.document.effects = this.document.effects.map(effect => {
            const data = effect.toObject();
            data.id = effect.id;
            if (effect.type === 'beastform') data.mandatory = true;

            return data;
        });

        return context;
    }

    async advantageOnAdd(event) {
        await this.document.update({
            'system.advantageOn': [...this.document.system.advantageOn, event.detail.data.value]
        });
    }

    async advantageOnRemove(event) {
        await this.document.update({
            'system.advantageOn': this.document.system.advantageOn.filter(x => x !== event.detail.data.value)
        });
    }
}
