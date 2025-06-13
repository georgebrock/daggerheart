import AncestryFeature from '../../../data/pseudo-documents/feature/itemFeature.mjs';
import DaggerheartSheet from '../daggerheart-sheet.mjs';

const { ItemSheetV2 } = foundry.applications.sheets;
export default class AncestrySheet extends DaggerheartSheet(ItemSheetV2) {
    static DEFAULT_OPTIONS = {
        tag: 'form',
        classes: ['daggerheart', 'sheet', 'item', 'dh-style', 'ancestry'],
        position: { width: 450, height: 700 },
        actions: {
            addFeature: this.addFeature,
            editFeature: this.editFeature,
            deleteFeature: this.deleteFeature
        },
        form: {
            handler: this.updateForm,
            submitOnChange: true,
            closeOnSubmit: false
        },
        dragDrop: [{ dragSelector: null, dropSelector: null }]
    };

    static PARTS = {
        header: { template: 'systems/daggerheart/templates/sheets/items/ancestry/header.hbs' },
        tabs: { template: 'systems/daggerheart/templates/sheets/global/tabs/tab-navigation.hbs' },
        description: { template: 'systems/daggerheart/templates/sheets/global/tabs/tab-description.hbs' },
        features: {
            template: 'systems/daggerheart/templates/sheets/global/tabs/tab-feature-section.hbs',
            scrollable: ['.features']
        }
    };

    static TABS = {
        description: {
            active: true,
            cssClass: '',
            group: 'primary',
            id: 'description',
            icon: null,
            label: 'DAGGERHEART.Sheets.Feature.Tabs.Description'
        },
        features: {
            active: false,
            cssClass: '',
            group: 'primary',
            id: 'features',
            icon: null,
            label: 'DAGGERHEART.Sheets.Feature.Tabs.Features'
        }
    };

    async _prepareContext(_options) {
        const context = await super._prepareContext(_options);
        context.document = this.document;
        context.tabs = super._getTabs(this.constructor.TABS);

        return context;
    }

    static async updateForm(event, _, formData) {
        await this.document.update(formData.object);
        this.render();
    }

    static async addFeature() {
        await AncestryFeature.create({ name: 'New Feature' }, { parent: this.document });
        this.render();
    }

    static async editFeature(_, target) {
        const feature = await fromUuid(target.dataset.feature);
        feature.sheet.render(true);
    }

    static async deleteFeature(_, target) {
        await this.document.system.features.get(target.dataset.feature).delete();
        this.render(true);
    }

    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);
        const item = await fromUuid(data.uuid);
        // if (item.type === 'feature' && item.system.type === SYSTEM.ITEM.featureTypes.ancestry.id) {
        //     await this.document.update({
        //         'system.abilities': [
        //             ...this.document.system.abilities,
        //             { img: item.img, name: item.name, uuid: item.uuid }
        //         ]
        //     });
        // }
    }
}
