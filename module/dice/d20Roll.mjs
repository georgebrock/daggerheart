import D20RollDialog from '../applications/dialogs/d20RollDialog.mjs';
import DHRoll from './dhRoll.mjs';

export default class D20Roll extends DHRoll {
    constructor(formula, data = {}, options = {}) {
        super(formula, data, options);
        this.constructFormula();
    }

    static ADV_MODE = {
        NORMAL: 0,
        ADVANTAGE: 1,
        DISADVANTAGE: -1
    };

    static messageType = 'adversaryRoll';

    static CRITICAL_TRESHOLD = 20;

    static DefaultDialog = D20RollDialog;

    get d20() {
        if (!(this.terms[0] instanceof foundry.dice.terms.Die)) this.createBaseDice();
        return this.terms[0];
    }

    set d20(faces) {
        if (!(this.terms[0] instanceof foundry.dice.terms.Die)) this.createBaseDice();
        this.terms[0].faces = this.getFaces(faces);
    }

    get dAdvantage() {
        return this.dice[2];
    }

    get isCritical() {
        if (!this.d20._evaluated) return;
        return this.d20.total >= this.constructor.CRITICAL_TRESHOLD;
    }

    get hasAdvantage() {
        const adv = this.options.roll.advantage.type ?? this.options.roll.advantage;
        return adv === this.constructor.ADV_MODE.ADVANTAGE;
    }

    get hasDisadvantage() {
        const adv = this.options.roll.advantage.type ?? this.options.roll.advantage;
        return adv === this.constructor.ADV_MODE.DISADVANTAGE;
    }

    static applyKeybindings(config) {
        let keys = {
            normal: true,
            advantage: false,
            disadvantage: false
        };

        if (config.event) {
            keys = {
                normal: config.event.shiftKey || config.event.altKey || config.event.ctrlKey,
                advantage: config.event.altKey,
                disadvantage: config.event.ctrlKey
            };
        }

        // Should the roll configuration dialog be displayed?
        config.dialog.configure ??= !Object.values(keys).some(k => k);

        // Determine advantage mode
        const advantage = config.roll.advantage === this.ADV_MODE.ADVANTAGE || keys.advantage || config.advantage;
        const disadvantage =
            config.roll.advantage === this.ADV_MODE.DISADVANTAGE || keys.disadvantage || config.disadvantage;
        if (advantage && !disadvantage) config.roll.advantage = this.ADV_MODE.ADVANTAGE;
        else if (!advantage && disadvantage) config.roll.advantage = this.ADV_MODE.DISADVANTAGE;
        else config.roll.advantage = this.ADV_MODE.NORMAL;
    }

    constructFormula(config) {
        this.createBaseDice();
        this.configureModifiers();
        this.resetFormula();
        return this._formula;
    }

    createBaseDice() {
        if (this.terms[0] instanceof foundry.dice.terms.Die) {
            this.terms = [this.terms[0]];
            return;
        }
        this.terms[0] = new foundry.dice.terms.Die({ faces: 20 });
    }

    configureModifiers() {
        this.applyAdvantage();
        
        this.baseTerms = foundry.utils.deepClone(this.dice);

        this.options.roll.modifiers = this.applyBaseBonus();

        this.options.experiences?.forEach(m => {
            if (this.options.data.experiences?.[m])
                this.options.roll.modifiers.push({
                    label: this.options.data.experiences[m].name,
                    value: this.options.data.experiences[m].value
                });
        });

        this.addModifiers();
        if (this.options.extraFormula) {
            this.terms.push(
                new foundry.dice.terms.OperatorTerm({ operator: '+' }),
                ...this.constructor.parse(this.options.extraFormula, this.options.data)
            );
        }
    }

    applyAdvantage() {
        this.d20.modifiers.findSplice(m => ['kh', 'kl'].includes(m));
        if (!this.hasAdvantage && !this.hasDisadvantage) this.d20.number = 1;
        else {
            this.d20.number = 2;
            this.d20.modifiers.push(this.hasAdvantage ? 'kh' : 'kl');
        }
    }

    applyBaseBonus() {
        const modifiers = [];

        if (this.options.roll.bonus)
            modifiers.push({
                label: 'Bonus to Hit',
                value: this.options.roll.bonus
            });

        modifiers.push(...this.getBonus(`roll.${this.options.type}`, `${this.options.type?.capitalize()} Bonus`));
        modifiers.push(
            ...this.getBonus(`roll.${this.options.roll.type}`, `${this.options.roll.type?.capitalize()} Bonus`)
        );

        return modifiers;
    }

    static postEvaluate(roll, config = {}) {
        const data = super.postEvaluate(roll, config);
        if (config.targets?.length) {
            config.targets.forEach(target => {
                const difficulty = config.roll.difficulty ?? target.difficulty ?? target.evasion;
                target.hit = this.isCritical || roll.total >= difficulty;
            });
        } else if (config.roll.difficulty)
            data.success = roll.isCritical || roll.total >= config.roll.difficulty;
        data.advantage = {
            type: config.roll.advantage,
            dice: roll.dAdvantage?.denomination,
            value: roll.dAdvantage?.total
        };
        data.isCritical = roll.isCritical;
        data.extra = roll.dice
            .filter(d => !roll.baseTerms.includes(d))
            .map(d => {
                return {
                    dice: d.denomination,
                    value: d.total
                };
            });
        data.modifierTotal = this.calculateTotalModifiers(roll);
        return data;
    }

    resetFormula() {
        return (this._formula = this.constructor.getFormula(this.terms));
    }
}
