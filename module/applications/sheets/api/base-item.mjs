import DHActionConfig from '../../sheets-configs/action-config.mjs';
import DHApplicationMixin from './application-mixin.mjs';

const { ItemSheetV2 } = foundry.applications.sheets;

/**@typedef {import('@client/applications/_types.mjs').ApplicationClickAction} ApplicationClickAction */

/**
 * A base item sheet extending {@link ItemSheetV2} via {@link DHApplicationMixin}
 * @extends ItemSheetV2
 * @mixes DHSheetV2
 */
export default class DHBaseItemSheet extends DHApplicationMixin(ItemSheetV2) {
    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        classes: ['item'],
        position: { width: 600 },
        window: { resizable: true },
        form: {
            submitOnChange: true
        },
        actions: {
            removeAction: DHBaseItemSheet.#removeAction,
            addFeature: DHBaseItemSheet.#addFeature,
            removeFeature: DHBaseItemSheet.#removeFeature
        },
        dragDrop: [
            { dragSelector: null, dropSelector: '.tab.features .drop-section' },
            { dragSelector: '.feature-item', dropSelector: null }
        ]
    };

    /* -------------------------------------------- */

    /** @inheritdoc */
    static TABS = {
        primary: {
            tabs: [{ id: 'description' }, { id: 'settings' }, { id: 'actions' }, { id: 'effects' }],
            initial: 'description',
            labelPrefix: 'DAGGERHEART.GENERAL.Tabs'
        }
    };

    /* -------------------------------------------- */
    /*  Prepare Context                             */
    /* -------------------------------------------- */

    /**@inheritdoc */
    async _preparePartContext(partId, context, options) {
        await super._preparePartContext(partId, context, options);
        const { TextEditor } = foundry.applications.ux;

        switch (partId) {
            case 'description':
                const value = foundry.utils.getProperty(this.document, 'system.description') ?? '';
                context.enrichedDescription = await TextEditor.enrichHTML(value, {
                    relativeTo: this.item,
                    rollData: this.item.getRollData(),
                    secrets: this.item.isOwner
                });
                break;
            case "effects":
                await this._prepareEffectsContext(context, options)
                break;
        }

        return context;
    }

    /**
     * Prepare render context for the Effect part.
     * @param {ApplicationRenderContext} context
     * @param {ApplicationRenderOptions} options
     * @returns {Promise<void>}
     * @protected
     */
    async _prepareEffectsContext(context, _options) {
        context.effects = {
            actives: [],
            inactives: [],
        };

        for (const effect of this.item.effects) {
            const list = effect.active ? context.effects.actives : context.effects.inactives;
            list.push(effect);
        }
    }

    /* -------------------------------------------- */
    /*  Application Clicks Actions                  */
    /* -------------------------------------------- */


    /**
     * Remove an action from the item.
     * @type {ApplicationClickAction}
     */
    static async #removeAction(event, button) {
        event.stopPropagation();
        const actionIndex = button.closest('[data-index]').dataset.index;
        const action = this.document.system.actions[actionIndex];

        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: {
                title: game.i18n.format('DAGGERHEART.APPLICATIONS.DeleteConfirmation.title', {
                    type: game.i18n.localize(`DAGGERHEART.GENERAL.Action.single`),
                    name: action.name
                })
            },
            content: game.i18n.format('DAGGERHEART.APPLICATIONS.DeleteConfirmation.text', { name: action.name })
        });
        if (!confirmed) return;

        await this.document.update({
            'system.actions': this.document.system.actions.filter((_, index) => index !== Number.parseInt(actionIndex))
        });
    }

    /**
     * Add a new feature to the item, prompting the user for its type.
     * @type {ApplicationClickAction}
     */
    static async #addFeature(_event, _button) {
        const cls = foundry.documents.Item.implementation;
        const feature = await cls.create({
            type: 'feature',
            name: cls.defaultName({ type: 'feature' }),
        });
        await this.document.update({
            'system.features': [...this.document.system.features, feature]
        });
    }

    /**
     * Remove a feature from the item.
     * @type {ApplicationClickAction}
     */
    static async #removeFeature(event, button) {
        event.stopPropagation();
        const target = button.closest('.feature-item');
        const feature = this.document.system.features.find(x => x && x.id === target.id);

        if (feature) {
            const confirmed = await foundry.applications.api.DialogV2.confirm({
                window: {
                    title: game.i18n.format('DAGGERHEART.APPLICATIONS.DeleteConfirmation.title', {
                        type: game.i18n.localize(`TYPES.Item.feature`),
                        name: feature.name
                    })
                },
                content: game.i18n.format('DAGGERHEART.APPLICATIONS.DeleteConfirmation.text', { name: feature.name })
            });
            if (!confirmed) return;
        }

        await this.document.update({
            'system.features': this.document.system.features
                .filter(feature => feature && feature.id !== target.id)
                .map(x => x.uuid)
        });
    }

    /* -------------------------------------------- */
    /*  Application Drag/Drop                       */
    /* -------------------------------------------- */

    /**
     * On dragStart on the item.
     * @param {DragEvent} event - The drag event
     */
    async _onDragStart(event) {
        const featureItem = event.currentTarget.closest('.feature-item');

        if (featureItem) {
            const feature = this.document.system.features.find(x => x?.id === featureItem.id);
            if (!feature) {
                ui.notifications.warn(game.i18n.localize('DAGGERHEART.UI.notifications.featureIsMissing'));
                return;
            }

            const featureData = { type: 'Item', data: { ...feature.toObject(), _id: null }, fromInternal: true };
            event.dataTransfer.setData('text/plain', JSON.stringify(featureData));
            event.dataTransfer.setDragImage(featureItem.querySelector('img'), 60, 0);
        }
    }

    /**
     * On drop on the item.
     * @param {DragEvent} event - The drag event
     */
    async _onDrop(event) {
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        if (data.fromInternal) return;

        const item = await fromUuid(data.uuid);
        if (item?.type === 'feature') {
            const current = this.document.system.features.map(x => x.uuid);
            await this.document.update({ 'system.features': [...current, item.uuid] });
        }
    }
}
