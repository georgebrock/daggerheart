import DamageSelectionDialog from '../../applications/damageSelectionDialog.mjs';
import CostSelectionDialog from '../../applications/costSelectionDialog.mjs';
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

    - Auto disable selected Cost from other cost list

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
    static extraSchemas = [];

    static defineSchema() {
        return {
            _id: new fields.DocumentIdField(),
            systemPath: new fields.StringField({ required: true, initial: 'actions' }),
            type: new fields.StringField({ initial: undefined, readonly: true, required: true }),
            name: new fields.StringField({ initial: undefined }),
            description: new fields.HTMLField(),
            img: new fields.FilePathField({ initial: undefined, categories: ['IMAGE'], base64: false }),
            chatDisplay: new fields.BooleanField({ initial: true, label: 'Display in chat' }),
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
            }),
            ...this.defineExtraSchema()
        };
    }

    static defineExtraSchema() {
        const extraFields = {
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
                ),
                healing: new fields.SchemaField({
                    type: new fields.StringField({
                        choices: SYSTEM.GENERAL.healingTypes,
                        required: true,
                        blank: false,
                        initial: SYSTEM.GENERAL.healingTypes.health.id,
                        label: 'Healing'
                    }),
                    value: new fields.EmbeddedDataField(DHActionDiceData)
                })
            },
            extraSchemas = {};
        
        this.extraSchemas.forEach(s => extraSchemas[s] = extraFields[s]);
        return extraSchemas;
    }

    prepareData() {}

    get index() {
        return foundry.utils.getProperty(this.parent, this.systemPath).indexOf(this);
    }

    get item() {
        return this.parent.parent;
    }

    get actor() {
        return this.item?.actor;
    }

    get chatTemplate() {
        return 'systems/daggerheart/templates/chat/duality-roll.hbs';
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
        let config = {
            event,
            title: this.item.name,
            source: {
                itemId: this.item._id,
                actionId: this._id
            },
            hasDamage: !!this.damage?.parts?.length,
            chatMessage: {
                template: this.chatTemplate
            }
        };

        this.proceedChatDisplay(config);
        
        // Display Costs Dialog & Check if Actor get enough resources
        config.costs = await this.getCost(config);
        if(!config.costs.hasCost) return ui.notifications.warn("You don't have the resources to use that action.");

        // Filter selected targets based on Target parameters
        config.targets = await this.getTarget(config);
        if(!config.targets) return ui.notifications.warn("Too many targets selected for that actions.");
        
        // Filter selected targets based on Range parameters
        config.range = await this.checkRange(config);
        if(!config.range.hasRange) return ui.notifications.warn("No Target within range.");

        // Proceed with Roll
        await this.proceedRoll(config);

        if (this.effects.length) {
            // Apply Active Effects. In Chat Message ?
        }
        
        // Update Actor resources based on Action Cost configuration
        this.spendCost(config.costs.values);

        return config;
    }

    /* ROLL */
    async proceedRoll(config) {
        if (!this.roll?.type || !this.roll?.trait) return;
        const modifierValue = this.actor.system.traits[this.roll.trait].value;
        config = {
            ...config,
            roll: {
                modifier: modifierValue,
                label: game.i18n.localize(abilities[this.roll.trait].label),
                type: this.actionType,
                difficulty: this.roll?.difficulty
            }
        }
        config.roll.evaluated = await this.actor.diceRoll(config);
    }
    /* ROLL */

    /* COST */
    async getCost(config) {
        if(!this.cost?.length || !this.actor) return {values: [], hasCost: true};
        let cost = foundry.utils.deepClone(this.cost);
        if (!config.event.shiftKey) {
            const dialogClosed = new Promise((resolve, _) => {
                new CostSelectionDialog(cost, resolve).render(true);
            });
            cost = await dialogClosed;
        }
        return {values: cost, hasCost: cost.reduce((a, c) => a && this.actor.system.resources[c.type]?.value >= (c.total ?? c.value), true)};
    }

    async spendCost(config) {
        if(!config.costs?.values?.length) return;
        return await this.actor.modifyResource(config.costs.values);
    }
    /* COST */

    /* TARGET */
    async getTarget(config) {
        if(this.target.type === SYSTEM.ACTIONS.targetTypes.self.id) return this.formatTarget(this.actor.token ?? this.actor.prototypeToken);
        let targets = Array.from(game.user.targets);
        // foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY
        if(this.target?.type && this.target.type !== SYSTEM.ACTIONS.targetTypes.any.id) {
            targets = targets.filter(t => this.isTargetFriendly(t));
            if(this.target.amount && targets.length > this.target.amount) return false;
        }
        return targets.map(t => this.formatTarget(t));
    }

    isTargetFriendly(target) {
        const actorDisposition = this.actor.token ? this.actor.token.disposition : this.actor.prototypeToken.disposition,
            targetDisposition = target.document.disposition;
        return (this.target.type === SYSTEM.ACTIONS.targetTypes.friendly.id && actorDisposition === targetDisposition) || (this.target.type === SYSTEM.ACTIONS.targetTypes.hostile.id && (actorDisposition + targetDisposition === 0))
    }

    formatTarget(actor) {
        return {
            id: actor.id,
            name: actor.actor.name,
            img: actor.actor.img,
            difficulty: actor.actor.system.difficulty,
            evasion: actor.actor.system.evasion?.value
        }
    }
    /* TARGET */
    
    /* RANGE */
    async checkRange(config) {
        if(!this.range || !this.actor) return true;
        return {values: [], hasRange: true};
    }
    /* RANGE */

    /* EFFECTS */
    async applyEffects(config) {
        if(!this.effects?.length) return;
    }
    /* EFFECTS */

    /* CHAT */
    async proceedChatDisplay(config) {
        if(!this.chatDisplay) return;
    }
    /* CHAT */
}

/* const extraDefineSchema = (field, option) => {
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
}; */

export class DHDamageAction extends DHBaseAction {
    directDamage = true;

    static extraSchemas = ['damage', 'target', 'effects'];

    /* static defineSchema() {
        return {
            ...super.defineSchema(),
            ...extraDefineSchema('damage'),
            ...extraDefineSchema('target'),
            ...extraDefineSchema('effects')
        };
    } */

    async use(event, ...args) {
        const messageData = await super.use(event, args);
        if(!this.directDamage) return;
        return await this.rollDamage(event, messageData);
    }

    async rollDamage(event, messageData) {
        let formula = this.damage.parts.map(p => p.getFormula(this.actor)).join(' + ');
            
        if (!formula || formula == '') return;
        let roll = { formula: formula, total: formula },
            bonusDamage = [];

        if (!event.shiftKey) {
            const dialogClosed = new Promise((resolve, _) => {
                new DamageSelectionDialog(formula, bonusDamage, resolve).render(true);
            });
            const result = await dialogClosed;
            bonusDamage = result.bonusDamage;
            formula = result.rollString;

            /* const automateHope = await game.settings.get(SYSTEM.id, SYSTEM.SETTINGS.gameSettings.Automation.Hope);
            if (automateHope && result.hopeUsed) {
                await this.update({
                    'system.resources.hope.value': this.system.resources.hope.value - result.hopeUsed
                });
            } */
        }

        if (isNaN(formula)) {
            roll = await new Roll(formula, this.getRollData()).evaluate();
        }
        if(!roll) return;
        const dice = [],
            modifiers = [];
        for (var i = 0; i < roll.terms.length; i++) {
            const term = roll.terms[i];
            if (term.faces) {
                dice.push({
                    type: `d${term.faces}`,
                    rolls: term.results.map(x => x.result),
                    total: term.results.reduce((acc, x) => acc + x.result, 0)
                });
            } else if (term.operator) {
            } else if (term.number) {
                const operator = i === 0 ? '' : roll.terms[i - 1].operator;
                modifiers.push({ value: term.number, operator: operator });
            }
        }

        // if(messageData?.system?.damage) {
        // } else {
            const cls = getDocumentClass('ChatMessage'),
                systemData = {
                    title: game.i18n.format('DAGGERHEART.Chat.DamageRoll.Title', { damage: this.name }),
                    roll: formula,
                    damage: {
                        total: roll.total,
                        type: this.damage.parts[0].type         // Handle multiple type damage
                    },
                    dice: dice,
                    modifiers: modifiers,
                    targets: []
                },
                msg = new cls({
                    type: 'damageRoll',
                    user: game.user.id,
                    sound: CONFIG.sounds.dice,
                    system: systemData,
                    content: await foundry.applications.handlebars.renderTemplate(
                        'systems/daggerheart/templates/chat/damage-roll.hbs',
                        systemData
                    ),
                    rolls: [roll]
                });

            cls.create(msg.toObject());
        // }

        
        /* const cls = getDocumentClass('ChatMessage'),
            msg = new cls({
                user: game.user.id,
                content: await foundry.applications.handlebars.renderTemplate(
                    this.chatTemplate,
                    {
                        ...{
                            roll: roll.formula,
                            total: roll.total,
                            dice: roll.dice,
                            type: this.damage.parts.map(p => p.type)
                        },
                        ...messageData
                    }
                )
            });

        cls.create(msg.toObject()); */
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
    // static extraSchemas = [];

    static extraSchemas = [...super.extraSchemas, ...['roll', 'save']];

    /* static defineSchema() {
        return {
            ...super.defineSchema(),
            ...extraDefineSchema('roll'),
            ...extraDefineSchema('save')
        };
    } */

    static getRollType(parent) {
        return parent.type === 'weapon' ? 'weapon' : 'spellcast';
    }

    get chatTemplate() {
        return 'systems/daggerheart/templates/chat/duality-roll.hbs';
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
    static extraSchemas = ['target', 'effects', 'healing'];

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
    static extraSchemas = ['effects'];
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
