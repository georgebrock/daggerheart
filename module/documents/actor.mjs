import DamageSelectionDialog from '../applications/damageSelectionDialog.mjs';
import { GMUpdateEvent, socketEvent } from '../helpers/socket.mjs';
import DamageReductionDialog from '../applications/damageReductionDialog.mjs';
import { LevelOptionType } from '../data/levelTier.mjs';
import DHFeature from '../data/item/feature.mjs';

export default class DhpActor extends Actor {
    async _preCreate(data, options, user) {
        if ((await super._preCreate(data, options, user)) === false) return false;

        // Configure prototype token settings
        const prototypeToken = {};
        if (['character', 'companion'].includes(this.type))
            Object.assign(prototypeToken, {
                sight: { enabled: true },
                actorLink: true,
                disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY
            });
        this.updateSource({ prototypeToken });
    }

    async updateLevel(newLevel) {
        if (!['character', 'companion'].includes(this.type) || newLevel === this.system.levelData.level.changed) return;

        if (newLevel > this.system.levelData.level.current) {
            const maxLevel = Object.values(
                game.settings.get(SYSTEM.id, SYSTEM.SETTINGS.gameSettings.LevelTiers).tiers
            ).reduce((acc, tier) => Math.max(acc, tier.levels.end), 0);
            if (newLevel > maxLevel) {
                ui.notifications.warn(game.i18n.localize('DAGGERHEART.Sheets.PC.Errors.tooHighLevel'));
            }

            await this.update({ 'system.levelData.level.changed': Math.min(newLevel, maxLevel) });
        } else {
            const usedLevel = Math.max(newLevel, 1);
            if (newLevel < 1) {
                ui.notifications.warn(game.i18n.localize('DAGGERHEART.Sheets.PC.Errors.tooLowLevel'));
            }

            const updatedLevelups = Object.keys(this.system.levelData.levelups).reduce((acc, level) => {
                if (Number(level) > usedLevel) acc[`-=${level}`] = null;

                return acc;
            }, {});

            const featureIds = [];
            const domainCards = [];
            const experiences = [];
            const subclassFeatureState = { class: null, multiclass: null };
            let multiclass = null;
            Object.keys(this.system.levelData.levelups)
                .filter(x => x > usedLevel)
                .forEach(levelKey => {
                    const level = this.system.levelData.levelups[levelKey];
                    const achievementCards = level.achievements.domainCards.map(x => x.itemUuid);
                    const advancementCards = level.selections.filter(x => x.type === 'domainCard').map(x => x.itemUuid);
                    domainCards.push(...achievementCards, ...advancementCards);
                    experiences.push(...Object.keys(level.achievements.experiences));
                    featureIds.push(...level.selections.flatMap(x => x.featureIds));

                    const subclass = level.selections.find(x => x.type === 'subclass');
                    if (subclass) {
                        const path = subclass.secondaryData.isMulticlass === 'true' ? 'multiclass' : 'class';
                        const subclassState = Number(subclass.secondaryData.featureState) - 1;
                        subclassFeatureState[path] = subclassFeatureState[path]
                            ? Math.min(subclassState, subclassFeatureState[path])
                            : subclassState;
                    }

                    multiclass = level.selections.find(x => x.type === 'multiclass');
                });

            for (let featureId of featureIds) {
                this.items.get(featureId).delete();
            }

            if (experiences.length > 0) {
                const getUpdate = () => ({
                    'system.experiences': experiences.reduce((acc, key) => {
                        acc[`-=${key}`] = null;
                        return acc;
                    }, {})
                });
                this.update(getUpdate());
                if (this.system.companion) {
                    this.system.companion.update(getUpdate());
                }
            }

            if (subclassFeatureState.class) {
                this.system.class.subclass.update({ 'system.featureState': subclassFeatureState.class });
            }

            if (subclassFeatureState.multiclass) {
                this.system.multiclass.subclass.update({ 'system.featureState': subclassFeatureState.multiclass });
            }

            if (multiclass) {
                const multiclassSubclass = this.items.find(x => x.type === 'subclass' && x.system.isMulticlass);
                const multiclassItem = this.items.find(x => x.uuid === multiclass.itemUuid);

                multiclassSubclass.delete();
                multiclassItem.delete();

                this.update({
                    'system.multiclass': {
                        value: null,
                        subclass: null
                    }
                });
            }

            for (let domainCard of domainCards) {
                const itemCard = this.items.find(x => x.uuid === domainCard);
                itemCard.delete();
            }

            await this.update({
                system: {
                    levelData: {
                        level: {
                            current: usedLevel,
                            changed: usedLevel
                        },
                        levelups: updatedLevelups
                    }
                }
            });

            if (this.system.companion) {
                this.system.companion.updateLevel(newLevel);
            }
        }
    }

    async levelUp(levelupData) {
        const actions = [];
        const levelups = {};
        for (var levelKey of Object.keys(levelupData)) {
            const level = levelupData[levelKey];

            for (var experienceKey in level.achievements.experiences) {
                const experience = level.achievements.experiences[experienceKey];
                await this.update({
                    [`system.experiences.${experienceKey}`]: {
                        name: experience.name,
                        value: experience.modifier
                    }
                });

                if (this.system.companion) {
                    await this.system.companion.update({
                        [`system.experiences.${experienceKey}`]: {
                            name: '',
                            value: experience.modifier
                        }
                    });
                }
            }

            let multiclass = null;
            const featureAdditions = [];
            const domainCards = [];
            const subclassFeatureState = { class: null, multiclass: null };
            const selections = [];
            for (var optionKey of Object.keys(level.choices)) {
                const selection = level.choices[optionKey];
                for (var checkboxNr of Object.keys(selection)) {
                    const checkbox = selection[checkboxNr];

                    const tierOption = LevelOptionType[checkbox.type];
                    if (tierOption.features?.length > 0) {
                        featureAdditions.push({
                            checkbox: {
                                ...checkbox,
                                level: Number(levelKey),
                                optionKey: optionKey,
                                checkboxNr: Number(checkboxNr)
                            },
                            features: tierOption.features
                        });
                    } else if (checkbox.type === 'multiclass') {
                        multiclass = {
                            ...checkbox,
                            level: Number(levelKey),
                            optionKey: optionKey,
                            checkboxNr: Number(checkboxNr)
                        };
                    } else if (checkbox.type === 'domainCard') {
                        domainCards.push({
                            ...checkbox,
                            level: Number(levelKey),
                            optionKey: optionKey,
                            checkboxNr: Number(checkboxNr)
                        });
                    } else {
                        if (checkbox.type === 'subclass') {
                            const path = checkbox.secondaryData.isMulticlass === 'true' ? 'multiclass' : 'class';
                            subclassFeatureState[path] = Math.max(
                                Number(checkbox.secondaryData.featureState),
                                subclassFeatureState[path]
                            );
                        }

                        selections.push({
                            ...checkbox,
                            level: Number(levelKey),
                            optionKey: optionKey,
                            checkboxNr: Number(checkboxNr)
                        });
                    }
                }
            }

            for (var addition of featureAdditions) {
                for (var featureData of addition.features) {
                    const feature = new DHFeature({
                        ...featureData,
                        description: game.i18n.localize(featureData.description)
                    });
                    const embeddedItem = await this.createEmbeddedDocuments('Item', [
                        {
                            ...featureData,
                            name: game.i18n.localize(featureData.name),
                            type: 'feature',
                            system: feature
                        }
                    ]);
                    addition.checkbox.featureIds = !addition.checkbox.featureIds
                        ? [embeddedItem[0].id]
                        : [...addition.checkbox.featureIds, embeddedItem[0].id];
                }

                selections.push(addition.checkbox);
            }

            if (multiclass) {
                const subclassItem = await foundry.utils.fromUuid(multiclass.secondaryData.subclass);
                const subclassData = subclassItem.toObject();
                const multiclassItem = await foundry.utils.fromUuid(multiclass.data[0]);
                const multiclassData = multiclassItem.toObject();

                const embeddedItem = await this.createEmbeddedDocuments('Item', [
                    {
                        ...multiclassData,
                        system: {
                            ...multiclassData.system,
                            domains: [multiclass.secondaryData.domain],
                            isMulticlass: true
                        }
                    }
                ]);

                await this.createEmbeddedDocuments('Item', [
                    {
                        ...subclassData,
                        system: {
                            ...subclassData.system,
                            isMulticlass: true
                        }
                    }
                ]);
                selections.push({ ...multiclass, itemUuid: embeddedItem[0].uuid });
            }

            for (var domainCard of domainCards) {
                const item = await foundry.utils.fromUuid(domainCard.data[0]);
                const embeddedItem = await this.createEmbeddedDocuments('Item', [item.toObject()]);
                selections.push({ ...domainCard, itemUuid: embeddedItem[0].uuid });
            }

            const achievementDomainCards = [];
            for (var card of Object.values(level.achievements.domainCards)) {
                const item = await foundry.utils.fromUuid(card.uuid);
                const embeddedItem = await this.createEmbeddedDocuments('Item', [item.toObject()]);
                card.itemUuid = embeddedItem[0].uuid;
                achievementDomainCards.push(card);
            }

            if (subclassFeatureState.class) {
                await this.system.class.subclass.update({ 'system.featureState': subclassFeatureState.class });
            }

            if (subclassFeatureState.multiclass) {
                await this.system.multiclass.subclass.update({
                    'system.featureState': subclassFeatureState.multiclass
                });
            }

            levelups[levelKey] = {
                achievements: {
                    ...level.achievements,
                    domainCards: achievementDomainCards
                },
                selections: selections
            };
        }

        await this.update({
            system: {
                actions: [...this.system.actions, ...actions],
                levelData: {
                    level: {
                        current: this.system.levelData.level.changed
                    },
                    levelups: levelups
                }
            }
        });

        if (this.system.companion) {
            this.system.companion.updateLevel(this.system.levelData.level.changed);
        }
    }

    /**
     * @param {object} config
     * @param {Event} config.event
     * @param {string} config.title
     * @param {object} config.roll
     * @param {number} config.roll.modifier
     * @param {boolean} [config.roll.simple=false]
     * @param {string} [config.roll.type]
     * @param {number} [config.roll.difficulty]
     * @param {boolean} [config.hasDamage]
     * @param {boolean} [config.hasEffect]
     * @param {object} [config.chatMessage]
     * @param {string} config.chatMessage.template
     * @param {boolean} [config.chatMessage.mute]
     * @param {object} [config.targets]
     * @param {object} [config.costs]
     */
    async diceRoll(config) {
        config.source = { ...(config.source ?? {}), actor: this.uuid };
        config.data = this.getRollData();
        const rollClass = config.roll.lite ? CONFIG.Dice.daggerheart['DHRoll'] : this.rollClass;
        return await rollClass.build(config);
    }

    get rollClass() {
        return CONFIG.Dice.daggerheart[this.type === 'character' ? 'DualityRoll' : 'D20Roll'];
    }

    getRollData() {
        return this.system;
    }

    formatRollModifier(roll) {
        const modifier = roll.modifier !== null ? Number.parseInt(roll.modifier) : null;
        return modifier !== null
            ? [
                  {
                      value: modifier,
                      label: roll.label
                          ? modifier >= 0
                              ? `${roll.label} +${modifier}`
                              : `${roll.label} ${modifier}`
                          : null,
                      title: roll.label
                  }
              ]
            : [];
    }

    async damageRoll(title, damage, targets, shiftKey) {
        let rollString = damage.value;
        let bonusDamage = damage.bonusDamage?.filter(x => x.initiallySelected) ?? [];
        if (!shiftKey) {
            const dialogClosed = new Promise((resolve, _) => {
                new DamageSelectionDialog(rollString, bonusDamage, resolve).render(true);
            });
            const result = await dialogClosed;
            bonusDamage = result.bonusDamage;
            rollString = result.rollString;

            const automateHope = await game.settings.get(SYSTEM.id, SYSTEM.SETTINGS.gameSettings.Automation.Hope);
            if (automateHope && result.hopeUsed) {
                await this.update({
                    'system.resources.hope.value': this.system.resources.hope.value - result.hopeUsed
                });
            }
        }

        const roll = new Roll(rollString);
        let rollResult = await roll.evaluate();

        const dice = [];
        const modifiers = [];
        for (var i = 0; i < rollResult.terms.length; i++) {
            const term = rollResult.terms[i];
            if (term.faces) {
                dice.push({
                    type: `d${term.faces}`,
                    rolls: term.results.map(x => x.result),
                    total: term.results.reduce((acc, x) => acc + x.result, 0)
                });
            } else if (term.operator) {
            } else if (term.number) {
                const operator = i === 0 ? '' : rollResult.terms[i - 1].operator;
                modifiers.push({ value: term.number, operator: operator });
            }
        }

        const cls = getDocumentClass('ChatMessage');
        const systemData = {
            title: game.i18n.format('DAGGERHEART.Chat.DamageRoll.Title', { damage: title }),
            roll: rollString,
            damage: {
                total: rollResult.total,
                type: damage.type
            },
            dice: dice,
            modifiers: modifiers,
            targets: targets
        };
        const msg = new cls({
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
    }

    async takeDamage(damage, type) {
        if (this.type === 'companion') {
            await this.modifyResource([{ value: 1, type: 'stress' }]);
            return;
        }

        const hpDamage =
            damage >= this.system.damageThresholds.severe
                ? 3
                : damage >= this.system.damageThresholds.major
                  ? 2
                  : damage >= this.system.damageThresholds.minor
                    ? 1
                    : 0;

        if (
            this.type === 'character' &&
            this.system.armor &&
            this.system.armor.system.marks.value < this.system.armorScore
        ) {
            new Promise((resolve, reject) => {
                new DamageReductionDialog(resolve, reject, this, hpDamage).render(true);
            })
                .then(async ({ modifiedDamage, armorSpent, stressSpent }) => {
                    const resources = [
                        { value: modifiedDamage, type: 'hitPoints' },
                        ...(armorSpent ? [{ value: armorSpent, type: 'armorStack' }] : []),
                        ...(stressSpent ? [{ value: stressSpent, type: 'stress' }] : [])
                    ];
                    await this.modifyResource(resources);
                })
                .catch(() => {
                    const cls = getDocumentClass('ChatMessage');
                    const msg = new cls({
                        user: game.user.id,
                        content: game.i18n.format('DAGGERHEART.DamageReduction.Notifications.DamageIgnore', {
                            character: this.name
                        })
                    });
                    cls.create(msg.toObject());
                });
        } else {
            await this.modifyResource([{ value: hpDamage, type: 'hitPoints' }]);
        }
    }

    async takeHealing(resources) {
        resources.forEach(r => (r.value *= -1));
        await this.modifyResource(resources);
    }

    async modifyResource(resources) {
        if (!resources.length) return;
        let updates = { actor: { target: this, resources: {} }, armor: { target: this.system.armor, resources: {} } };
        resources.forEach(r => {
            switch (r.type) {
                case 'fear':
                    ui.resources.updateFear(
                        game.settings.get(SYSTEM.id, SYSTEM.SETTINGS.gameSettings.Resources.Fear) + r.value
                    );
                    break;
                case 'armorStack':
                    updates.armor.resources['system.marks.value'] = Math.max(
                        Math.min(this.system.armor.system.marks.value + r.value, this.system.armorScore),
                        0
                    );
                    break;
                default:
                    updates.actor.resources[`system.resources.${r.type}.value`] = Math.max(
                        Math.min(
                            this.system.resources[r.type].value + r.value,
                            this.system.resources[r.type].maxTotal ?? this.system.resources[r.type].max
                        ),
                        0
                    );
                    break;
            }
        });
        Object.values(updates).forEach(async u => {
            if (Object.keys(u.resources).length > 0) {
                if (game.user.isGM) {
                    await u.target.update(u.resources);
                } else {
                    await game.socket.emit(`system.${SYSTEM.id}`, {
                        action: socketEvent.GMUpdate,
                        data: {
                            action: GMUpdateEvent.UpdateDocument,
                            uuid: u.target.uuid,
                            update: u.resources
                        }
                    });
                }
            }
        });
    }
}
