const { HandlebarsApplicationMixin } = foundry.applications.api;

export default function PseudoDocumentMixin(Base) {
    return class PseudoDocumentSheet extends HandlebarsApplicationMixin(Base) {
        constructor(options) {
            super(options);
            this.#pseudoDocument = options.document;
        }

        /**
         * The UUID of the associated pseudo-document
         * @type {string}
         */
        get pseudoUuid() {
            return this.pseudoDocument.uuid;
        }

        #pseudoDocument;

        /**
         * The pseudo-document instance this sheet represents
         * @type {object}
         */
        get pseudoDocument() {
            return this.#pseudoDocument;
        }

        static DEFAULT_OPTIONS = {
            tag: 'form',
            classes: ['daggerheart', 'sheet', 'dh-style', 'pseudo'],
            position: { width: 600 },
            actions: {
                editImage: this.editImage
            },
            form: {
                handler: PseudoDocumentSheet.#onSubmitForm,
                submitOnChange: true,
                closeOnSubmit: false
            },
            dragDrop: [{ dragSelector: null, dropSelector: null }]
        };

        static PARTS = {
            header: { template: 'systems/daggerheart/templates/sheets/items/feature/header.hbs' }
        };

        /** @inheritDoc */
        async _prepareContext(options) {
            const context = await super._prepareContext(options);
            const document = this.pseudoDocument;
            return Object.assign(context, {
                document,
                source: document._source,
                systemFields: document.schema.fields,
                editable: this.isEditable,
                user: game.user,
                rootId: this.id
            });
        }

        /**
         * Form submission handler
         * @param {SubmitEvent | Event} event - The originating form submission or input change event
         * @param {HTMLFormElement} form - The form element that was submitted
         * @param {foundry.applications.ux.FormDataExtended} formData - Processed data for the submitted form
         */
        static async #onSubmitForm(event, form, formData) {
            const submitData = foundry.utils.expandObject(formData.object);
            await this.pseudoDocument.update(submitData);
        }

        _getTabs(tabs) {
            for (const v of Object.values(tabs)) {
                v.active = this.tabGroups[v.group] ? this.tabGroups[v.group] === v.id : v.active;
                v.cssClass = v.active ? 'active' : '';
            }

            return tabs;
        }

        static editImage(_, target) {
            const attr = target.dataset.edit;
            const current = foundry.utils.getProperty(this.pseudoDocument, attr);
            const fp = new FilePicker({
                current,
                type: 'image',
                callback: async path => this._updateImage.bind(this)(path),
                top: this.position.top + 40,
                left: this.position.left + 10
            });
            return fp.browse();
        }

        async _updateImage(path) {
            await this.pseudoDocument.update({ img: path });
        }
    };
}
