const { HandlebarsApplicationMixin } = foundry.applications.api;
import { getDocFromElement, tagifyElement } from '../../../helpers/utils.mjs';
import DHActionConfig from '../../sheets-configs/action-config.mjs';

/**
 * @typedef {import('@client/applications/_types.mjs').ApplicationClickAction}
 */

/**
 * @typedef {object} DragDropConfig
 * @property {string} [dragSelector] - A CSS selector that identifies draggable elements.
 * @property {string} [dropSelector] - A CSS selector that identifies drop targets.
 *
 * @typedef {object} ContextMenuConfig
 * @property {() => ContextMenuEntry[]} handler - A handler function that provides initial context options
 * @property {string} selector - A CSS selector to which the ContextMenu will be bound
 * @property {object} [options] - Additional options which affect ContextMenu construction
 * @property {HTMLElement} [options.container] - A parent HTMLElement which contains the selector target
 * @property {string} [options.hookName] - The hook name
 * @property {boolean} [options.parentClassHooks=true] - Whether to call hooks for the parent classes in the inheritance chain.
 *
 * @typedef {Object} TagOption
 * @property {string} label
 * @property {string} [src]
 *
 * @typedef {object} TagifyConfig
 * @property {String} selector - The CSS selector for get the element to transform into a tag input
 * @property {Record<string, TagOption> | (() => Record<string, TagOption>)} options - Available tag options as key-value pairs
 * @property {TagChangeCallback} callback - Callback function triggered when tags change
 * @property {TagifyOptions} [tagifyOptions={}] - Additional configuration for Tagify
 *
 * @callback TagChangeCallback
 * @param {Array<{value: string, name: string, src?: string}>} selectedOptions - Current selected tags
 * @param {{option: string, removed: boolean}} change - What changed (added/removed tag)
 * @param {HTMLElement} inputElement - Original input element
 *
 *
 * @typedef {Object} TagifyOptions
 * @property {number} [maxTags] - Maximum number of allowed tags
 */

/**
 * @typedef {import("@client/applications/api/handlebars-application.mjs").HandlebarsRenderOptions} HandlebarsRenderOptions
 * @typedef {foundry.applications.types.ApplicationConfiguration} FoundryAppConfig
 *
 * @typedef {FoundryAppConfig & HandlebarsRenderOptions & {
 *   dragDrop?: DragDropConfig[],
 *   tagifyConfigs?: TagifyConfig[],
 *   contextMenus?: ContextMenuConfig[],
 * }} DHSheetV2Configuration
 */

/**
 * @template {Constructor<foundry.applications.api.DocumentSheet>} BaseDocumentSheet
 * @param {BaseDocumentSheet} Base - The base class to extend.
 * @returns {BaseDocumentSheet}
 */
export default function DHApplicationMixin(Base) {
    class DHSheetV2 extends HandlebarsApplicationMixin(Base) {
        /**
         * @param {DHSheetV2Configuration} [options={}]
         */
        constructor(options = {}) {
            super(options);
            /**
             * @type {foundry.applications.ux.DragDrop[]}
             * @private
             */
            this._dragDrop = this._createDragDropHandlers();
        }

        /**
         * The default options for the sheet.
         * @type {DHSheetV2Configuration}
         */
        static DEFAULT_OPTIONS = {
            classes: ['daggerheart', 'sheet', 'dh-style'],
            actions: {
                createDoc: DHSheetV2.#createDoc,
                editDoc: DHSheetV2.#editDoc,
                deleteDoc: DHSheetV2.#deleteDoc,
                toChat: DHSheetV2.#toChat,
                useItem: DHSheetV2.#useItem,
            },
            contextMenus: [],
            dragDrop: [],
            tagifyConfigs: []
        };

        /* -------------------------------------------- */

        /**@inheritdoc */
        _attachPartListeners(partId, htmlElement, options) {
            super._attachPartListeners(partId, htmlElement, options);
            this._dragDrop.forEach(d => d.bind(htmlElement));
        }
        /**@inheritdoc */
        async _onFirstRender(context, options) {
            await super._onFirstRender(context, options);
            if (!!this.options.contextMenus.length) this._createContextMenus();
        }

        /**@inheritdoc */
        async _onRender(context, options) {
            await super._onRender(context, options);
            this._createTagifyElements(this.options.tagifyConfigs);
        }

        /* -------------------------------------------- */
        /*  Tags                                        */
        /* -------------------------------------------- */

        /**
         * Creates Tagify elements from configuration objects
         * @param {TagifyConfig[]} tagConfigs - Array of Tagify configuration objects
         * @throws {TypeError} If tagConfigs is not an array
         * @throws {Error} If required properties are missing in config objects
         * @param {TagifyConfig[]} tagConfigs
         */
        _createTagifyElements(tagConfigs) {
            if (!Array.isArray(tagConfigs)) throw new TypeError('tagConfigs must be an array');

            tagConfigs.forEach(config => {
                try {
                    const { selector, options, callback, tagifyOptions = {} } = config;

                    // Validate required fields
                    if (!selector || !options || !callback) {
                        throw new Error('Invalid TagifyConfig - missing required properties', config);
                    }

                    // Find target element
                    const element = this.element.querySelector(selector);
                    if (!element) {
                        throw new Error(`Element not found with selector: ${selector}`);
                    }
                    // Resolve dynamic options if function provided
                    const resolvedOptions = typeof options === 'function' ? options.call(this) : options;

                    // Initialize Tagify
                    tagifyElement(element, resolvedOptions, callback.bind(this), tagifyOptions);
                } catch (error) {
                    console.error('Error initializing Tagify:', error);
                }
            });
        }

        /* -------------------------------------------- */
        /*  Drag and Drop                               */
        /* -------------------------------------------- */

        /**
         * Creates drag-drop handlers from the configured options.
         * @returns {foundry.applications.ux.DragDrop[]}
         * @private
         */
        _createDragDropHandlers() {
            return this.options.dragDrop.map(d => {
                d.callbacks = {
                    dragstart: this._onDragStart.bind(this),
                    drop: this._onDrop.bind(this)
                };
                return new foundry.applications.ux.DragDrop.implementation(d);
            });
        }

        /**
         * Handle dragStart event.
         * @param {DragEvent} event
         * @protected
         */
        _onDragStart(event) { }

        /**
         * Handle drop event.
         * @param {DragEvent} event
         * @protected
         */
        _onDrop(event) { }

        /* -------------------------------------------- */
        /*  Context Menu                                */
        /* -------------------------------------------- */

        _createContextMenus() {
            for (const config of this.options.contextMenus) {
                const { handler, selector, options } = config;
                this._createContextMenu(handler.bind(this), selector, options);
            }
        }

        /* -------------------------------------------- */

        /**
         * Get the set of ContextMenu options which should be used for journal entry pages in the sidebar.
         * @returns {import('@client/applications/ux/context-menu.mjs').ContextMenuEntry[]}
         * @protected
         */
        _getEntryContextOptions() {
            return [];
        }

        /* -------------------------------------------- */
        /*  Prepare Context                             */
        /* -------------------------------------------- */

        /**@inheritdoc*/
        async _prepareContext(options) {
            const context = await super._prepareContext(options);
            context.config = CONFIG.DH;
            context.source = this.document;
            context.fields = this.document.schema.fields;
            context.systemFields = this.document.system.schema.fields;
            return context;
        }

        /* -------------------------------------------- */
        /*  Application Clicks Actions                  */
        /* -------------------------------------------- */

        /**
         * Create an embedded document.
         * @type {ApplicationClickAction}
         */
        static async #createDoc(event, target) {
            const { documentClass, type } = target.dataset;
            const parent = this.document;

            const cls = getDocumentClass(documentClass);
            return await cls.createDocuments(
                [
                    {
                        name: cls.defaultName({ type, parent }),
                        type
                    }
                ],
                { parent, renderSheet: !event.shiftKey }
            );
        }

        /**
         * Renders an embedded document.
         * @type {ApplicationClickAction}
         */
        static #editDoc(_event, target) {
            const doc = getDocFromElement(target);

            // TODO: REDO this
            if (doc) return doc.sheet.render({ force: true });
            const { actionId } = target.closest('[data-action-id]').dataset;
            const { actions, attack } = this.document.system;
            const action = attack.id === actionId ? attack : actions?.find(a => a.id === actionId);
            new DHActionConfig(action).render({ force: true })
        }

        /**
         * Delete an embedded document.
         * @type {ApplicationClickAction}
         */
        static async #deleteDoc(_event, target) {
            const doc = getDocFromElement(target);

            // TODO: REDO this
            if (doc) return await doc.deleteDialog()

            const { actionId } = target.closest('[data-action-id]').dataset;
            const { actions, attack } = this.document.system;
            if (attack.id === actionId) return;
            const action = actions.find(a => a.id === actionId);

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

            return await this.document.update({
                'system.actions': actions.filter((a) => a.id !== action.id)
            });
        }

        /**
         * Send item to Chat
         * @type {ApplicationClickAction}
         */
        static async #toChat(_event, target) {
            let doc = getDocFromElement(target);

            // TODO: REDO this
            if (!doc) {
                const { actionId } = target.closest('[data-action-id]').dataset;
                const { actions, attack } = this.document.system;
                doc = attack.id === actionId ? attack : actions?.find(a => a.id === actionId);
            }
            return doc.toChat(this.document.id);
        }

        /**
         * Use a item
         * @type {ApplicationClickAction}
         */
        static async #useItem(event, target) {
            let doc = getDocFromElement(target);

            // TODO: REDO this
            if (!doc) {
                const { actionId } = target.closest('[data-action-id]').dataset;
                const { actions, attack } = this.document.system;
                doc = attack.id === actionId ? attack : actions?.find(a => a.id === actionId);
            }

            await doc.use(event);
        }

    }

    return DHSheetV2;
}
