import DHItemSheetV2 from '../item.mjs';

const { ItemSheetV2 } = foundry.applications.sheets;
export default class DomainCardSheet extends DHItemSheetV2(ItemSheetV2) {
    static DEFAULT_OPTIONS = {
        classes: ['domain-card'],
        position: { width: 450, height: 700 },
        actions: {
            addEffect: this.addEffect,
            editEffect: this.editEffect,
            removeEffect: this.removeEffect
        }
    };

    static PARTS = {
        header: { template: 'systems/daggerheart/templates/sheets/items/domainCard/header.hbs' },
        tabs: { template: 'systems/daggerheart/templates/sheets/global/tabs/tab-navigation.hbs' },
        description: { template: 'systems/daggerheart/templates/sheets/global/tabs/tab-description.hbs' },
        settings: {
            template: 'systems/daggerheart/templates/sheets/items/domainCard/settings.hbs',
            scrollable: ['.settings']
        },
        actions: {
            template: 'systems/daggerheart/templates/sheets/global/tabs/tab-actions.hbs',
            scrollable: ['.actions']
        },
        effects: {
            template: 'systems/daggerheart/templates/sheets/global/tabs/tab-effects.hbs',
            scrollable: ['.effects']
        }
    };

    static TABS = {
        ...super.TABS,
        effects: {
            active: false,
            cssClass: '',
            group: 'primary',
            id: 'effects',
            icon: null,
            label: 'DAGGERHEART.Sheets.Feature.Tabs.Effects'
        }
    };

    static async addEffect() {
        await this.document.createEmbeddedDocuments('ActiveEffect', [
            { name: game.i18n.localize('DAGGERHEART.Feature.NewEffect') }
        ]);
    }

    static async editEffect(_, target) {
        const effect = this.document.effects.get(target.dataset.effect);
        effect.sheet.render(true);
    }

    static async removeEffect(_, target) {
        await this.document.effects.get(target.dataset.effect).delete();
    }
}
