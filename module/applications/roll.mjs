
export default class DHRoll extends Roll {
    static async build(config={}, message={}) {
        const roll = await this.buildConfigure();
        await this.buildEvaluate(config, message={});
        await this.buildPost(config, message={});
        return roll;
    }
    
    static async buildConfigure(config={}, message={}) {
        config.hooks = [...(config.hooks ?? []), ""];
        for ( const hook of config.hooks ) {
            if ( Hooks.call(`dnd5e.preRoll${hook.capitalize()}`, config, message) === false ) return null;
        }
    }
    
    static async buildEvaluate(roll, config={}, message={}) {
        if(config.evaluate !== false) await roll.evalutate();
    }
    
    static async buildPost(config, message) {
        for ( const hook of config.hooks ) {
            if ( Hooks.call(`dnd5e.postRoll${hook.capitalize()}`, config, message) === false ) return null;
        }
        // Create Chat Message
        await this.toMessage(roll, message.data);
    }

    static async toMessage(roll, data) {
        
        const cls = getDocumentClass("ChatMessage");
        const msg = new cls(data);
    }
}