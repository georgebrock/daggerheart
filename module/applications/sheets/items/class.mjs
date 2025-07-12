import DHBaseItemSheet from '../api/base-item.mjs';

const { TextEditor } = foundry.applications.ux;

export default class ClassSheet extends DHBaseItemSheet {
    /**@inheritdoc */
    static DEFAULT_OPTIONS = {
        classes: ['class'],
        position: { width: 700 },
        actions: {
            removeItemFromCollection: ClassSheet.#removeItemFromCollection,
            removeSuggestedItem: ClassSheet.#removeSuggestedItem,
            addFeature: ClassSheet.#addFeature,
            deleteFeature: ClassSheet.#deleteFeature
        },
        tagifyConfigs: [
            {
                selector: '.domain-input',
                options: () => CONFIG.DH.DOMAIN.domains,
                callback: ClassSheet.#onDomainSelect
            }
        ],
        dragDrop: [
            { dragSelector: '.suggested-item', dropSelector: null },
            { dragSelector: null, dropSelector: '.take-section' },
            { dragSelector: null, dropSelector: '.choice-a-section' },
            { dragSelector: null, dropSelector: '.choice-b-section' },
            { dragSelector: null, dropSelector: '.primary-weapon-section' },
            { dragSelector: null, dropSelector: '.secondary-weapon-section' },
            { dragSelector: null, dropSelector: '.armor-section' },
            { dragSelector: null, dropSelector: null }
        ]
    };

    /**@override */
    static PARTS = {
        header: { template: 'systems/daggerheart/templates/sheets/items/class/header.hbs' },
        tabs: { template: 'systems/daggerheart/templates/sheets/global/tabs/tab-navigation.hbs' },
        description: { template: 'systems/daggerheart/templates/sheets/global/tabs/tab-description.hbs' },
        features: {
            template: 'systems/daggerheart/templates/sheets/items/class/features.hbs',
            scrollable: ['.features']
        },
        settings: {
            template: 'systems/daggerheart/templates/sheets/items/class/settings.hbs',
            scrollable: ['.settings']
        }
    };

    /** @inheritdoc */
    static TABS = {
        primary: {
            tabs: [{ id: 'description' }, { id: 'features' }, { id: 'settings' }],
            initial: 'description',
            labelPrefix: 'DAGGERHEART.GENERAL.Tabs'
        }
    };

    /**@inheritdoc */
    async _prepareContext(_options) {
        const context = await super._prepareContext(_options);
        context.domains = this.document.system.domains;
        return context;
    }

    /* -------------------------------------------- */

    /**
     * Callback function used by `tagifyElement`.
     * @param {Array<Object>} selectedOptions - The currently selected tag objects.
     */
    static async #onDomainSelect(selectedOptions) {
        await this.document.update({ 'system.domains': selectedOptions.map(x => x.value) });
    }

    /* -------------------------------------------- */

    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);
        const item = await fromUuid(data.uuid);
        const target = event.target.closest('fieldset.drop-section');
        if (item.type === 'subclass') {
            await this.document.update({
                'system.subclasses': [...this.document.system.subclasses.map(x => x.uuid), item.uuid]
            });
        } else if (item.type === 'weapon') {
            if (target.classList.contains('primary-weapon-section')) {
                if (!this.document.system.characterGuide.suggestedPrimaryWeapon && !item.system.secondary)
                    await this.document.update({
                        'system.characterGuide.suggestedPrimaryWeapon': item.uuid
                    });
            } else if (target.classList.contains('secondary-weapon-section')) {
                if (!this.document.system.characterGuide.suggestedSecondaryWeapon && item.system.secondary)
                    await this.document.update({
                        'system.characterGuide.suggestedSecondaryWeapon': item.uuid
                    });
            }
        } else if (item.type === 'armor') {
            if (target.classList.contains('armor-section')) {
                if (!this.document.system.characterGuide.suggestedArmor)
                    await this.document.update({
                        'system.characterGuide.suggestedArmor': item.uuid
                    });
            }
        } else if (target.classList.contains('choice-a-section')) {
            if (item.type === 'miscellaneous' || item.type === 'consumable') {
                if (this.document.system.inventory.choiceA.length < 2)
                    await this.document.update({
                        'system.inventory.choiceA': [
                            ...this.document.system.inventory.choiceA.map(x => x.uuid),
                            item.uuid
                        ]
                    });
            }
        } else if (item.type === 'miscellaneous') {
            if (target.classList.contains('take-section')) {
                if (this.document.system.inventory.take.length < 3)
                    await this.document.update({
                        'system.inventory.take': [...this.document.system.inventory.take.map(x => x.uuid), item.uuid]
                    });
            } else if (target.classList.contains('choice-b-section')) {
                if (this.document.system.inventory.choiceB.length < 2)
                    await this.document.update({
                        'system.inventory.choiceB': [
                            ...this.document.system.inventory.choiceB.map(x => x.uuid),
                            item.uuid
                        ]
                    });
            }
        }
    }

    /* -------------------------------------------- */
    /*  Application Clicks Actions                  */
    /* -------------------------------------------- */

    /**
     * Removes an item from an class collection by UUID.
     * @param {PointerEvent} event - The originating click event
     * @param {HTMLElement} element - The capturing HTML element which defines the [data-action="removeItemFromCollection"]
     */
    static async #removeItemFromCollection(_event, element) {
        const { uuid, target } = element.dataset;
        const prop = foundry.utils.getProperty(this.document.system, target);
        await this.document.update({ [target]: prop.filter(i => i.uuid !== uuid) });
    }

    /**
     * Removes an suggested item from the class.
     * @param {PointerEvent} _event - The originating click event
     * @param {HTMLElement} element - The capturing HTML element which defines the [data-action="removeSuggestedItem"]
     */
    static async #removeSuggestedItem(_event, element) {
        const { target } = element.dataset;
        await this.document.update({ [`system.characterGuide.${target}`]: null });
    }

    static async #addFeature(_, target) {
        const { actionPath } = target.dataset;
        const cls = foundry.documents.Item.implementation;

        const feature = await cls.create({
            type: 'feature',
            name: cls.defaultName({ type: 'feature'}),
        });

        await this.document.update({
            [`system.${actionPath}`]: [
                ...this.document.system[actionPath],
                feature.uuid
            ]
        });
    }

    static async #deleteFeature(_, button) {
        const { actionPath, itemUuid } = button.dataset;
        await this.document.update({
            [`system.${actionPath}`]: this.document.system[actionPath].filter(f => f.uuid !== itemUuid)
        });
    }
}
