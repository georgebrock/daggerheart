import DHBaseItemSheet from '../api/base-item.mjs';

export default class SubclassSheet extends DHBaseItemSheet {
    /**@inheritdoc */
    static DEFAULT_OPTIONS = {
        classes: ['subclass'],
        position: { width: 600 },
        window: { resizable: false },
        actions: {
            addFeature: this.addFeature,
            deleteFeature: this.deleteFeature
        }
    };

    /**@override */
    static PARTS = {
        header: { template: 'systems/daggerheart/templates/sheets/items/subclass/header.hbs' },
        tabs: { template: 'systems/daggerheart/templates/sheets/global/tabs/tab-navigation.hbs' },
        description: { template: 'systems/daggerheart/templates/sheets/global/tabs/tab-description.hbs' },
        features: {
            template: 'systems/daggerheart/templates/sheets/items/subclass/features.hbs',
            scrollable: ['.features']
        },
        settings: {
            template: 'systems/daggerheart/templates/sheets/items/subclass/settings.hbs',
            scrollable: ['.settings']
        },
        effects: {
            template: 'systems/daggerheart/templates/sheets/global/tabs/tab-effects.hbs',
            scrollable: ['.effects']
        }
    };

    /** @inheritdoc */
    static TABS = {
        primary: {
            tabs: [{ id: 'description' }, { id: 'features' }, { id: 'settings' }, { id: 'effects' }],
            initial: 'description',
            labelPrefix: 'DAGGERHEART.GENERAL.Tabs'
        }
    };

    static async addFeature(_, target) {
        const cls = foundry.documents.Item.implementation;
        const feature = await cls.create({
            type: 'feature',
            name: cls.defaultName({ type: 'feature' }),
        });

        await this.document.update({
            [`system.${target.dataset.type}`]: feature
        });
    }

    static async deleteFeature(_, button) {
        await this.document.update({
            [`system.${button.dataset.actionPath}`]: null
        });
    }

    async _onDragStart(event) {
        const featureItem = event.currentTarget.closest('.drop-section');

        if (featureItem) {
            const feature = this.document.system[featureItem.dataset.type];
            if (!feature) {
                ui.notifications.warn(game.i18n.localize('DAGGERHEART.UI.Notifications.featureIsMissing'));
                return;
            }

            const featureData = { type: 'Item', data: { ...feature.toObject(), _id: null }, fromInternal: true };
            event.dataTransfer.setData('text/plain', JSON.stringify(featureData));
            event.dataTransfer.setDragImage(featureItem.querySelector('img'), 60, 0);
        }
    }

    async _onDrop(event) {
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        if (data.fromInternal) return;

        const item = await fromUuid(data.uuid);
        if (item?.type === 'feature') {
            const dropSection = event.target.closest('.drop-section');
            if (this.document.system[dropSection.dataset.type]) {
                ui.notifications.warn(game.i18n.localize('DAGGERHEART.UI.notifications.featureIsFull'));
                return;
            }

            await this.document.update({ [`system.${dropSection.dataset.type}`]: item.uuid });
        }
    }
}
