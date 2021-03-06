﻿"use strict";

module SamiTS {
    export interface WebVTTWriterOptions {
        createStyleElement?: boolean;
        disableDefaultStyle?: boolean;
        enableLanguageTag?: boolean;
        /** The default value is "video". */
        selector?: string;
        /** Some browsers including MSEdge requires --> after STYLE and NOTE */
        legacyForceArrow?: boolean;
    }

    export class WebVTTWriter {
        private webvttStyleSheet = new WebVTTStyleSheet();
        write(xsyncs: SAMICue[], options: WebVTTWriterOptions = {}) {
            let subHeader = "WEBVTT";
            let subDocument = '';
            let writeText = (i: number, text: string) => {
                subDocument += "\r\n\r\n";
                subDocument += this.getWebVTTTime(parseInt(xsyncs[i].syncElement.getAttribute("start"))) + " --> " + this.getWebVTTTime(parseInt(xsyncs[i + 1].syncElement.getAttribute("start")));
                subDocument += "\r\n" + text;
            };
            options = Object.assign(<DOMReadOptionBag>{ preventEmptyLine: true }, options);

            let text: string;
            if (xsyncs.length > 0) {
                let readElement = this.readNode.bind(this);
                
                for (let i = 0; i < xsyncs.length - 1; i++) {
                    text = util.absorbAir(xsyncs[i].readDOM(readElement, options as any));//prevents cues consists of a single &nbsp;
                    if (text.length > 0)
                        writeText(i, text);
                }
            }

            // WebVTT Styling https://w3c.github.io/webvtt/#styling
            subHeader += `\r\n\r\nSTYLE${options.legacyForceArrow ? " -->" : ""}\r\n` + this.webvttStyleSheet.getStylesheet(options);
            subDocument = subHeader + subDocument + "\r\n";

            let result: SamiTSResult = { subtitle: subDocument };
            if (options.createStyleElement)
                result.stylesheet = this.webvttStyleSheet.getStylesheetNode(options);

            this.webvttStyleSheet.clear();
            return result;
        }

        private getWebVTTTime(ms: number) {
            let hour = (ms - ms % 3600000) / 3600000;
            ms -= hour * 3600000;
            let min = (ms - ms % 60000) / 60000;
            ms -= min * 60000;
            let sec = (ms - ms % 1000) / 1000;
            ms -= sec * 1000;
            let hourstr: string;
            let minstr = min.toString();
            if (minstr.length < 2) minstr = '0' + minstr;
            let secstr = sec.toString();
            if (secstr.length < 2) secstr = '0' + secstr;
            let msstr = ms.toString();
            while (msstr.length < 3) msstr = '0' + msstr;

            if (hour > 0) {
                hourstr = hour.toString();
                if (hourstr.length < 2) hourstr = '0' + hourstr;
                return `${hourstr}:${minstr}:${secstr}.${msstr}`;
            }
            else
                return `${minstr}:${secstr}.${msstr}`;
        }

        private readNode(node: Node | SAMIContentElement, options: WebVTTWriterOptions): TagReadResult {
            let template = util.generateTagReadResultTemplate();
            if (!(node instanceof Element)) {
                if (node instanceof Comment && util.isLastRelevantNodeInSync(node)) {
                    // no visible text or element after this
                    const text = util.fillEmptyLines(node.textContent.trim());
                    const note = `NOTE${options.legacyForceArrow ? " -->" : ""}`
                    template.content = "\r\n\r\n" + (text.includes("\n") ? `${note}\r\n${text}` : `${note} ${text}`);
                }
                return template;
            }
            switch (node.tagName.toLowerCase()) {
                case "p":
                    template.divides = true;
                    break;
                case "br":
                    template.linebreak = true;
                    break;
                case "font": {
                    let stylename = this.registerStyle(node);
                    if (stylename) {
                        template.start = `<c.${stylename}>`;
                        template.end = "</c>";
                    }
                    break;
                }
                case "rp":
                    template = null;
                    break;
                case "ruby":
                case "rt":
                case "b":
                case "i":
                case "u": {
                    let tagname = node.tagName.toLowerCase();
                    template.start = `<${tagname}>`;
                    template.end = `</${tagname}>`;
                    break;
                }
            }
            if (options.enableLanguageTag && node.dataset.language && template.content.trim()) {
                template.start = `<lang ${node.dataset.language}>` + template.start;
                template.end += "</lang>";
            }
            return template;
        }

        private registerStyle(fontelement: HTMLElement) {
            let styleName = '';
            let rule = '';
            let color = fontelement.getAttribute("color");
            if (color) {
                styleName += 'c' + color.replace('#', '').toLowerCase();
                rule += `color: ${color};`;
            }
            if (styleName.length != 0 && !this.webvttStyleSheet.hasRuleFor(styleName))
                this.webvttStyleSheet.insertRuleFor(styleName, rule);
            return styleName;
        }
    }

    class WebVTTStyleSheet {
        private ruledictionary: any = {};
        private conventionalStyle: string[] = [
            "::cue { background: transparent; text-shadow: 0 0 0.2em black; text-outline: 2px 2px black; }",
            "::cue-region { font: 0.077vh sans-serif; line-height: 0.1vh; }"
        ];
        hasRuleFor(targetname: string) {
            return !!this.ruledictionary[targetname];
        }
        insertRuleFor(targetname: string, rule: string) {
            this.ruledictionary[targetname] = `::cue(.${targetname}) { ${rule} }`;
        }
        getStylesheet(options: WebVTTWriterOptions) {
            let resultarray: string[] = [];
            if (!options.disableDefaultStyle) {
                for (let rule of this.conventionalStyle) {
                    resultarray.push(rule);
                }
            }
            for (let rule in this.ruledictionary)
                resultarray.push(<string>this.ruledictionary[rule]);
            return resultarray.join('\r\n');
        }
        getStylesheetNode(options: WebVTTWriterOptions) {
            let selector = options.selector || "video";

            let styleSheet = document.createElement("style");
            let result = '';
            if (!options.disableDefaultStyle) {
                for (let rule of this.conventionalStyle) {
                    result += selector + rule;
                }
            }
            for (let rule in this.ruledictionary)
                result += selector + <string>this.ruledictionary[rule];
            styleSheet.appendChild(document.createTextNode(result));
            return styleSheet;
        }
        clear() {
            this.ruledictionary = {};
        }
    }
}
