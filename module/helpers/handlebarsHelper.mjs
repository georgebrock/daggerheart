import { getWidthOfText } from './utils.mjs';

export default class RegisterHandlebarsHelpers {
    static registerHelpers() {
        Handlebars.registerHelper({
            times: this.times,
            add: this.add,
            subtract: this.subtract,
            includes: this.includes,
        });
    }

    static times(nr, block) {
        var accum = '';
        for (var i = 0; i < nr; ++i) accum += block.fn(i);
        return accum;
    }

    static add(a, b) {
        const aNum = Number.parseInt(a);
        const bNum = Number.parseInt(b);
        return (Number.isNaN(aNum) ? 0 : aNum) + (Number.isNaN(bNum) ? 0 : bNum);
    }

    static subtract(a, b) {
        const aNum = Number.parseInt(a);
        const bNum = Number.parseInt(b);
        return (Number.isNaN(aNum) ? 0 : aNum) - (Number.isNaN(bNum) ? 0 : bNum);
    }

    static includes(list, item) {
        return list.includes(item);
    }

}
