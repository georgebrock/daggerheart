import { abilities } from '../../config/actorConfig.mjs';
import { DHActionDiceData, DHDamageData, DHDamageField } from './actionDice.mjs';

const fields = foundry.data.fields;

/*
    ToDo
    - Apply ActiveEffect => Add to Chat message like Damage Button ?
    - Add Drag & Drop for documentUUID field (Macro & Summon)
    - Add optionnal Role for Healing ?
    - Handle Roll result as part of formula if needed
    - Target Check
    - Cost Check
    - Range Check
    - Area of effect and measurement placement
    - Auto use costs and action

    Activity Types List
    - Attack => Weapon Attack, Spell Attack, etc...
    - Effects => Like Attack without damage
    - Damage => Like Attack without roll
    - Healing
    - Resource => Merge Healing & Resource ?
    - Summon
    - Sequencer => Trigger a list of Activities set on the item one by one
    - Macro
*/

export class DHBaseAction extends foundry.abstract.DataModel {
    static defineSchema() {
        return {
            _id: new fields.DocumentIdField(),
            type: new fields.StringField({ initial: undefined, readonly: true, required: true }),
            name: new fields.StringField({ initial: undefined }),
            description: new fields.HTMLField(),
            img: new fields.FilePathField({ initial: undefined, categories: ['IMAGE'], base64: false }),
            actionType: new fields.StringField({ choices: SYSTEM.ITEM.actionTypes, initial: 'action', nullable: true }),
            cost: new fields.ArrayField(
                new fields.SchemaField({
                    type: new fields.StringField({
                        choices: SYSTEM.GENERAL.abilityCosts,
                        nullable: false,
                        required: true,
                        initial: 'hope'
                    }),
                    value: new fields.NumberField({ nullable: true, initial: 1 }),
                    scalable: new fields.BooleanField({ initial: false }),
                    step: new fields.NumberField({ nullable: true, initial: null })
                })
            ),
            uses: new fields.SchemaField({
                value: new fields.NumberField({ nullable: true, initial: null }),
                max: new fields.NumberField({ nullable: true, initial: null }),
                recovery: new fields.StringField({
                    choices: SYSTEM.GENERAL.refreshTypes,
                    initial: null,
                    nullable: true
                })
            }),
            range: new fields.StringField({
                choices: SYSTEM.GENERAL.range,
                required: false,
                blank: true,
                initial: null
            })
        };
    }

    prepareData() {}

    get index() {
        return this.parent.actions.indexOf(this);
    }

    get item() {
        return this.parent.parent;
    }

    get actor() {
        return this.item?.actor;
    }

    get chatTemplate() {
        return 'systems/daggerheart/templates/chat/attack-roll.hbs';
    }

    static getRollType(parent) {
        return 'ability';
    }

    static getSourceConfig(parent) {
        const updateSource = {};
        updateSource.img ??= parent?.img ?? parent?.system?.img;
        if (parent?.system?.trait) {
            updateSource['roll'] = {
                type: this.getRollType(parent),
                trait: parent.system.trait
            };
        }
        if(parent?.type === 'weapon' && !!this.schema.fields.damage) {
            updateSource['damage'] = {includeBase: true};
        }
        if (parent?.system?.range) {
            updateSource['range'] = parent?.system?.range;
        }
        return updateSource;
    }

    getRollData() {
        const actorData = this.actor.getRollData(false);
        return {
            ...actorData.toObject(),
            prof: actorData.proficiency?.value ?? 1,
            cast: actorData.spellcast?.value ?? 1,
            scale: this.cost.length ? this.cost.reduce((a,c) => {a[c.type] = c.value; return a},{}) : 1
        }
    }

    async use(event, ...args) {
        // throw new Error("Activity must implement a 'use' method.");
        const data = {
            itemUUID: this.item,
            activityId: this.id
        };
        
        if(this.cost?.length) {
            const hasCost = await this.checkCost();
            if(!hasCost) return ui.notifications.warn("You don't have the resources to use that action.");
        }
        if(this.target?.type) {
            const hasTarget = await this.checkTarget();
        }
        if(this.range) {
            const hasRange = await this.checkRange();
        }
        if (this.roll?.type && this.roll?.trait) {
            const modifierValue = this.actor.system.traits[this.roll.trait].value;
            const config = {
                event: event,
                title: this.item.name,
                roll: {
                    modifier: modifierValue,
                    label: game.i18n.localize(abilities[this.roll.trait].label),
                    type: this.actionType,
                    difficulty: this.roll?.difficulty
                },
                chatMessage: {
                    template: this.chatTemplate
                }
            };
            if (this.target?.type) config.checkTarget = true;
            if (this.damage.parts.length) {
                config.damage = {
                    value: this.damage.parts.map(p => p.getFormula(this.actor)).join(' + '),
                    type: this.damage.parts[0].type
                };
            }
            if (this.effects.length) {
                // Apply Active Effects. In Chat Message ?
            }
            data.roll = await this.actor.diceRoll(config);
        }
        if(this.withMessage || true) {

        }

        return data;
    }

    async checkCost() {
        if(!this.cost.length || !this.actor) return true;
        console.log(this.actor, this.cost)
        return this.cost.reduce((a, c) => a && this.actor.system.resources[c.type]?.value >= (c.value * (c.scalable ? c.step : 1)), true);
    }

    async checkTarget() {
        /* targets = Array.from(game.user.targets).map(x => {
            const target = {
                id: x.id,
                name: x.actor.name,
                img: x.actor.img,
                difficulty: x.actor.system.difficulty,
                evasion: x.actor.system.evasion?.value
            };

            target.hit = target.difficulty ? roll.total >= target.difficulty : roll.total >= target.evasion;

            return target;
        }); */
        const targets = targets = Array.from(game.user.targets).map(x => {
            return {
                id,
                name: this.actor.name,
                img: x.actor.img,
                difficulty: x.actor.system.difficulty,
                evasion: x.actor.system.evasion?.value
            }
        });
        console.log(this.target)
        if(this.target.type === SYSTEM.ACTIONS.targetTypes.self.id) return this.actor;
        if(this.target.amount) {

        }
    }
    
    async checkRange() {
        console.log(this.range)
    }
}

const extraDefineSchema = (field, option) => {
    return {
        [field]: {
            // damage: new fields.SchemaField({
            //     parts: new fields.ArrayField(new fields.EmbeddedDataField(DHDamageData))
            // }),
            damage: new DHDamageField(),
            roll: new fields.SchemaField({
                type: new fields.StringField({ nullable: true, initial: null, choices: SYSTEM.GENERAL.rollTypes }),
                trait: new fields.StringField({ nullable: true, initial: null, choices: SYSTEM.ACTOR.abilities }),
                difficulty: new fields.NumberField({ nullable: true, initial: null, integer: true, min: 0 })
            }),
            save: new fields.SchemaField({
                trait: new fields.StringField({ nullable: true, initial: null, choices: SYSTEM.ACTOR.abilities }),
                difficulty: new fields.NumberField({ nullable: true, initial: null, integer: true, min: 0 })
            }),
            target: new fields.SchemaField({
                type: new fields.StringField({
                    choices: SYSTEM.ACTIONS.targetTypes,
                    initial: SYSTEM.ACTIONS.targetTypes.any.id,
                    nullable: true, initial: null
                }),
                amount: new fields.NumberField({ nullable: true, initial: null, integer: true, min: 0 })
            }),
            effects: new fields.ArrayField( // ActiveEffect
                new fields.SchemaField({
                    _id: new fields.DocumentIdField()
                })
            )
        }[field]
    };
};

export class DHDamageAction extends DHBaseAction {
    directDamage = true;

    static defineSchema() {
        return {
            ...super.defineSchema(),
            ...extraDefineSchema('damage'),
            ...extraDefineSchema('target'),
            ...extraDefineSchema('effects')
        };
    }

    async use(event, ...args) {
        const messageData = await super.use(event, args);
        if(!this.directDamage) return;
        const roll = await this.rollDamage();
        if(!roll) return;
        const cls = getDocumentClass('ChatMessage'),
            msg = new cls({
                user: game.user.id,
                content: await foundry.applications.handlebars.renderTemplate(
                    this.chatTemplate,
                    {
                        ...roll,
                        ...messageData
                    }
                )
            });

        cls.create(msg.toObject());
    }

    async rollDamage() {
        const formula = this.damage.parts.map(p => p.getFormula(this.actor)).join(' + ');
        console.log(this, formula)
        if (!formula || formula == '') return;

        let roll = { formula: formula, total: formula };
        if (isNaN(formula)) {
            roll = await new Roll(formula, this.getRollData()).evaluate();
        }
        console.log(roll)
        return {
            roll: roll.formula,
            total: roll.total,
            dice: roll.dice,
            type: this.damage.parts.map(p => p.type)
        }
    }

    get chatTemplate() {
        return 'systems/daggerheart/templates/chat/damage-roll.hbs';
    }

    /* async use(event, ...args) {
        const formula = this.damage.parts.map(p => p.getFormula(this.actor)).join(' + ');
        if (!formula || formula == '') return;

        let roll = { formula: formula, total: formula };
        if (isNaN(formula)) {
            roll = await new Roll(formula).evaluate();
        }

        const cls = getDocumentClass('ChatMessage');
        const msg = new cls({
            user: game.user.id,
            content: await foundry.applications.handlebars.renderTemplate(
                'systems/daggerheart/templates/chat/damage-roll.hbs',
                {
                    roll: roll.formula,
                    total: roll.total,
                    type: this.damage.parts.map(p => p.type)
                }
            )
        });

        cls.create(msg.toObject());
    } */

    /* async applyDamage(targets, value) {
        const promises = [];
        for(let t of targets) {
            if(!t) continue;
            promises.push(new Promise(async (resolve, reject) => {
                    await t.takeDamage(value, 'physical'); // Apply one instance of damage per parts ?
                    resolve();
                })
            )
        }
        return Promise.all(promises).then((values) => {
            return values;
        });
    } */
}

export class DHAttackAction extends DHDamageAction {
    directDamage = false;

    static defineSchema() {
        return {
            ...super.defineSchema(),
            ...extraDefineSchema('roll'),
            ...extraDefineSchema('save')
        };
    }

    static getRollType(parent) {
        return parent.type === 'weapon' ? 'weapon' : 'spellcast';
    }

    get chatTemplate() {
        return 'systems/daggerheart/templates/chat/attack-roll.hbs';
    }

    prepareData() {
        super.prepareData();
        if (this.damage.includeBase && !!this.item?.system?.damage) {
            const baseDamage = this.getParentDamage();
            this.damage.parts.unshift(new DHDamageData(baseDamage));
        }
    }

    getParentDamage() {
        return {
            multiplier: 'proficiency',
            dice: this.item?.system?.damage.value,
            bonus: this.item?.system?.damage.bonus ?? 0,
            type: this.item?.system?.damage.type,
            base: true
        };
    }

    /* async use(event, ...args) {

    } */

    // Temporary until full formula parser
    // getDamageFormula() {
    //     return this.damage.parts.map(p => p.formula).join(' + ');
    // }
}

/* export class DHSpellCastAction extends DHBaseAction {
    static defineSchema() {
        return {
            ...super.defineSchema(),
            ...extraDefineSchema('damage'),
            ...extraDefineSchema('roll'),
            ...extraDefineSchema('target'),
            ...extraDefineSchema('effects')
        };
    }

    static getRollType(parent) {
        return 'spellcast';
    }
} */

export class DHHealingAction extends DHBaseAction {
    static defineSchema() {
        return {
            ...super.defineSchema(),
            healing: new fields.SchemaField({
                type: new fields.StringField({
                    choices: SYSTEM.GENERAL.healingTypes,
                    required: true,
                    blank: false,
                    initial: SYSTEM.GENERAL.healingTypes.health.id,
                    label: 'Healing'
                }),
                value: new fields.EmbeddedDataField(DHActionDiceData)
            }),
            ...extraDefineSchema('target'),
            ...extraDefineSchema('effects')
        };
    }

    async use(event, ...args) {
        const messageData = await super.use(event, args),
            roll = await this.rollHealing(),
            cls = getDocumentClass('ChatMessage'),
            msg = new cls({
                user: game.user.id,
                content: await foundry.applications.handlebars.renderTemplate(
                    this.chatTemplate,
                    {
                        ...roll,
                        ...messageData
                    }
                )
            });

        cls.create(msg.toObject());
    }

    async rollHealing() {
        const formula = this.healing.value.getFormula(this.actor);
        if (!formula || formula == '') return;

        let roll = { formula: formula, total: formula };
        if (isNaN(formula)) {
            roll = await new Roll(formula, this.getRollData()).evaluate();
        }
        return {
            roll: roll.formula,
            total: roll.total,
            dice: roll.dice,
            type: this.healing.type
        }
    }

    get chatTemplate() {
        return 'systems/daggerheart/templates/chat/healing-roll.hbs';
    }
}

/* export class DHResourceAction extends DHBaseAction {
    static defineSchema() {
        return {
            ...super.defineSchema(),
            // ...extraDefineSchema('roll'),
            ...extraDefineSchema('target'),
            ...extraDefineSchema('effects'),
            resource: new fields.SchemaField({
                type: new fields.StringField({
                    choices: [],
                    blank: true,
                    required: false,
                    initial: '',
                    label: 'Resource'
                }),
                value: new fields.NumberField({ initial: 0, label: 'Value' })
            })
        };
    }
} */

export class DHSummonAction extends DHBaseAction {
    static defineSchema() {
        return {
            ...super.defineSchema(),
            documentUUID: new fields.StringField({ blank: true, initial: '', placeholder: 'Enter a Creature UUID' })
        };
    }
}

export class DHEffectAction extends DHBaseAction {
    static defineSchema() {
        return {
            ...super.defineSchema(),
            ...extraDefineSchema('effects')
        };
    }
}

export class DHMacroAction extends DHBaseAction {
    static defineSchema() {
        return {
            ...super.defineSchema(),
            documentUUID: new fields.StringField({ blank: true, initial: '', placeholder: 'Enter a macro UUID' })
        };
    }

    async use(event, ...args) {
        const fixUUID = !this.documentUUID.includes('Macro.') ? `Macro.${this.documentUUID}` : this.documentUUID,
            macro = await fromUuid(fixUUID);
        try {
            if (!macro) throw new Error(`No macro found for the UUID: ${this.documentUUID}.`);
            macro.execute();
        } catch (error) {
            ui.notifications.error(error);
        }
    }
}
