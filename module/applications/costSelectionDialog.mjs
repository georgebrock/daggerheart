const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class CostSelectionDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(costs, action, resolve) {
        super({});
        this.costs = costs;
        this.action = action;
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
            sendCost: this.sendCost
        },
        form: {
            handler: this.updateForm,
            submitOnChange: true,
            closeOnSubmit: false
        }
    };

    /** @override */
    static PARTS = {
        costSelection: {
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
        const updatedCosts = this.action.calcCosts(this.costs);
        return {
            costs: updatedCosts,
            canUse: this.action.getRealCosts(updatedCosts)?.hasCost
        };
    }

    static async updateForm(event, _, formData) {
        this.costs = foundry.utils.mergeObject(this.costs, foundry.utils.expandObject(formData.object).costs);
        this.render(true)
    }

    static sendCost(event) {
        event.preventDefault();
        this.resolve(this.action.getRealCosts(this.costs));
        this.close();
    }
}