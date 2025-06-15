const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class CostSelectionDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(cost, resolve) {
        super({});
        this.cost = cost;
        this.resolve = resolve;
    }

    static DEFAULT_OPTIONS = {
        tag: 'form',
        classes: ['daggerheart', 'views', 'damage-selection'],
        position: {
            width: 400,
            height: 'auto'
        },
        actions: {
            sendHope: this.sendHope
        },
        form: {
            handler: this.updateForm,
            submitOnChange: true,
            closeOnSubmit: false
        }
    };

    /** @override */
    static PARTS = {
        damageSelection: {
            id: 'costSelection',
            template: 'systems/daggerheart/templates/views/costSelection.hbs'
        }
    };

    /* -------------------------------------------- */

    /** @inheritDoc */
    get title() {
        return `Cost Options`;
    }

    async _prepareContext(_options) {
        return {
            cost: this.cost.map(c => {
                c.scale = c.scale ?? 1;
                c.step = c.step ?? 1;
                c.total = c.value * c.scale * c.step;
                c.enabled = c.hasOwnProperty('enabled') ? c.enabled : true;
                return c
            })
        };
    }

    static async updateForm(event, _, formData) {
        this.cost = foundry.utils.mergeObject(this.cost, foundry.utils.expandObject(formData.object));
        this.render(true)
    }

    static sendHope(event) {
        event.preventDefault();
        this.resolve(this.cost.filter(c => c.enabled));
        this.close();
    }
}