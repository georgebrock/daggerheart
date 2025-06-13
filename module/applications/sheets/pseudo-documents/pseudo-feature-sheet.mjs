import { actionsTypes } from '../../../data/_module.mjs';
import DHActionConfig from '../../config/Action.mjs';
import PseudoDocumentMixin from './pseudo-documents-sheet.mjs';

const { ApplicationV2 } = foundry.applications.api;

export default class PseudoFeatureSheet extends PseudoDocumentMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        classes: ['item'],
        actions: {
            addAction: this.addAction,
            removeAction: this.removeAction,
            editAction: this.editAction,
            addEffect: this.addEffect,
            deleteEffect: this.deleteEffect,
            editEffect: this.editEffect
        }
    };

    static PARTS = {
        header: { template: 'systems/daggerheart/templates/sheets/items/feature/header.hbs' },
        tabs: { template: 'systems/daggerheart/templates/sheets/global/tabs/tab-navigation.hbs' },
        description: { template: 'systems/daggerheart/templates/sheets/global/tabs/tab-description.hbs' },
        actions: {
            template: 'systems/daggerheart/templates/sheets/global/tabs/tab-actions.hbs',
            scrollable: ['.actions']
        },
        effects: {
            template: 'systems/daggerheart/templates/sheets/items/feature/effects.hbs',
            scrollable: ['.effects']
        }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        return Object.assign(context, {
            headerLabel: game.i18n.format('DAGGERHEART.Feature.FeatureTypeLabel', {
                type: game.i18n.localize(`DAGGERHEART.Feature.Type.${this.pseudoDocument.parent.parent.type}`)
            }),
            tabs: this._getTabs(this.constructor.TABS)
        });
    }

    static TABS = {
        description: {
            active: true,
            cssClass: '',
            group: 'primary',
            id: 'description',
            icon: null,
            label: 'DAGGERHEART.Sheets.Feature.Tabs.Description'
        },
        actions: {
            active: false,
            cssClass: '',
            group: 'primary',
            id: 'actions',
            icon: null,
            label: 'DAGGERHEART.Sheets.Feature.Tabs.Actions'
        },
        effects: {
            active: false,
            cssClass: '',
            group: 'primary',
            id: 'effects',
            icon: null,
            label: 'DAGGERHEART.Sheets.Feature.Tabs.Effects'
        }
    };

    async selectActionType() {
        const content = await foundry.applications.handlebars.renderTemplate(
                'systems/daggerheart/templates/views/actionType.hbs',
                { types: SYSTEM.ACTIONS.actionTypes }
            ),
            title = 'Select Action Type',
            type = 'form',
            data = {};
        return Dialog.prompt({
            title,
            label: title,
            content,
            type,
            callback: html => {
                const form = html[0].querySelector('form'),
                    fd = new foundry.applications.ux.FormDataExtended(form);
                foundry.utils.mergeObject(data, fd.object, { inplace: true });
                return data;
            },
            rejectClose: false
        });
    }

    static async addAction() {
        const actionType = await this.selectActionType();
        try {
            const cls = actionsTypes[actionType?.type] ?? actionsTypes.attack,
                action = new cls(
                    {
                        _id: foundry.utils.randomID(),
                        type: actionType.type,
                        name: game.i18n.localize(SYSTEM.ACTIONS.actionTypes[actionType.type].name),
                        ...cls.getSourceConfig(this.pseudoDocument)
                    },
                    {
                        parent: this.pseudoDocument
                    }
                );
            await this.pseudoDocument.update({ actions: [...this.pseudoDocument.actions, action] });
            await new DHActionConfig(this.pseudoDocument.actions[this.pseudoDocument.actions.length - 1]).render(true);
        } catch (error) {
            console.log(error);
        }
    }

    static async removeAction(_, button) {
        await this.pseudoDocument.update({
            actions: this.pseudoDocument.actions.filter((_, index) => index !== Number.parseInt(button.dataset.index))
        });
    }

    static async editAction(_, button) {
        const action = this.pseudoDocument.actions[button.dataset.index];
        await new DHActionConfig(action).render(true);
    }

    static async addEffect() {
        const effect = await this.pseudoDocument.parent.parent.createEmbeddedDocuments('ActiveEffect', [
            { name: game.i18n.localize('DAGGERHEART.ActiveEffect.New') }
        ]);
        await this.pseudoDocument.update({
            effects: [...this.pseudoDocument.effects.map(x => x.uuid), effect[0].uuid]
        });
    }

    static async deleteEffect(_, target) {
        await this.pseudoDocument.parent.parent.effects.get(target.dataset.effect).delete();
        await this.pseudoDocument.update({
            effects: this.pseudoDocument.effects.filter(x => x.id !== target.dataset.effect)
        });
    }

    static async editEffect(_, target) {
        const effect = this.pseudoDocument.parent.parent.effects.get(target.dataset.effect);
        effect.sheet.render(true);
    }
}
