const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class BeastformDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(configData) {
        super();

        this.configData = configData;
        this.selected = null;
        this.evolved = { form: null };
        this.hybrid = null;

        this._dragDrop = this._createDragDropHandlers();
    }

    static DEFAULT_OPTIONS = {
        tag: 'form',
        classes: ['daggerheart', 'views', 'dh-style', 'beastform-selection'],
        position: {
            width: 'auto',
            height: 'auto'
        },
        actions: {
            selectBeastform: this.selectBeastform,
            submitBeastform: this.submitBeastform
        },
        form: {
            handler: this.updateBeastform,
            submitOnChange: true,
            submitOnClose: false
        },
        dragDrop: [{ dragSelector: '.beastform-container', dropSelector: '.advanced-form-container' }]
    };

    get title() {
        return game.i18n.localize('DAGGERHEART.ITEMS.Beastform.dialogTitle');
    }

    /** @override */
    static PARTS = {
        beastform: {
            template: 'systems/daggerheart/templates/dialogs/beastformDialog.hbs'
        }
    };

    _createDragDropHandlers() {
        return this.options.dragDrop.map(d => {
            d.callbacks = {
                dragstart: this._onDragStart.bind(this),
                drop: this._onDrop.bind(this)
            };
            return new foundry.applications.ux.DragDrop.implementation(d);
        });
    }

    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);

        this._dragDrop.forEach(d => d.bind(htmlElement));
    }

    async _prepareContext(_options) {
        const context = await super._prepareContext(_options);

        context.selected = this.selected;
        context.selectedBeastformEffect = this.selected?.effects?.find?.(x => x.type === 'beastform');

        context.evolved = this.evolved;
        context.hybrid = this.hybrid;

        const maximumDragTier = Math.max(
            this.selected?.system?.evolved?.maximumTier ?? 0,
            this.selected?.system?.hybrid?.maximumTier ?? 0
        );

        const compendiumBeastforms = await game.packs.get(`daggerheart.beastforms`)?.getDocuments();
        context.beastformTiers = [...(compendiumBeastforms ? compendiumBeastforms : []), ...game.items].reduce(
            (acc, x) => {
                const tier = CONFIG.DH.GENERAL.tiersAlternate[x.system.tier];
                if (x.type !== 'beastform' || tier.id > this.configData.tierLimit) return acc;

                if (!acc[tier.id]) acc[tier.id] = { label: game.i18n.localize(tier.label), values: {} };

                acc[tier.id].values[x.uuid] = {
                    selected: this.selected?.uuid == x.uuid,
                    value: x,
                    draggable: maximumDragTier ? x.system.tier <= maximumDragTier : false
                };

                return acc;
            },
            {}
        ); // Also get from compendium when added

        context.canSubmit = this.canSubmit();

        return context;
    }

    canSubmit() {
        if (this.selected) {
            switch (this.selected.system.beastformType) {
                case 'normal':
                    return true;
                case 'evolved':
                    return this.evolved.form;
            }
        }

        return false;
    }

    static updateBeastform(event, _, formData) {
        this.selected = foundry.utils.mergeObject(this.selected, formData.object);

        this.render();
    }

    static async selectBeastform(_, target) {
        this.element.querySelectorAll('.beastform-container ').forEach(element => {
            if (element.dataset.uuid === target.dataset.uuid && this.selected?.uuid !== target.dataset.uuid) {
                element.classList.remove('inactive');
            } else {
                element.classList.add('inactive');
            }
        });

        const uuid = this.selected?.uuid === target.dataset.uuid ? null : target.dataset.uuid;
        this.selected = uuid ? await foundry.utils.fromUuid(uuid) : null;

        if (this.selected && this.selected.system.beastformType !== CONFIG.DH.ITEM.beastformTypes.normal.id) {
            this.element.querySelector('.advanced-container').classList.add('expanded');
        } else {
            this.element.querySelector('.advanced-container').classList.remove('expanded');
        }

        if (this.selected) {
            if (this.selected.system.beastformType !== 'evolved') this.evolved.form = null;
            if (this.selected.system.beastformType !== 'hybrid') this.hybrid = null;
        }

        this.render();
    }

    static async submitBeastform() {
        await this.close({ submitted: true });
    }

    /** @override */
    _onClose(options = {}) {
        if (!options.submitted) this.selected = null;
    }

    static async configure(configData) {
        return new Promise(resolve => {
            const app = new this(configData);
            app.addEventListener(
                'close',
                () => resolve({ selected: app.selected, evolved: app.evolved, hybrid: app.hybrid }),
                { once: true }
            );
            app.render({ force: true });
        });
    }

    async _onDragStart(event) {
        const target = event.currentTarget;
        if (!this.selected) {
            event.preventDefault();
            return;
        }

        const draggedForm = await foundry.utils.fromUuid(target.dataset.uuid);
        if (this.selected.system.beastformType === 'evolved') {
            if (draggedForm.system.tier > this.selected.system.evolved.maximumTier) {
                event.preventDefault();
                return;
            }
        }
        if (this.selected.system.beastformType === 'hybrid') {
            if (draggedForm.system.tier > this.selected.system.hybrid.maximumTier) {
                event.preventDefault();
                return;
            }
        }

        event.dataTransfer.setData('text/plain', JSON.stringify(target.dataset));
        event.dataTransfer.setDragImage(target, 60, 0);
    }

    async _onDrop(event) {
        event.stopPropagation();
        const data = foundry.applications.ux.TextEditor.getDragEventData(event);
        const item = await fromUuid(data.uuid);

        if (event.target.closest('.advanced-form-container.evolved')) {
            this.evolved.form = item;
        }

        this.render();
    }
}
