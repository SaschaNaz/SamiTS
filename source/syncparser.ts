﻿///<reference path='htmltagfinder.ts' />
"use strict";

module SamiTS {
    interface SamiLanguage {
        className: string;
        languageName: string;
        languageCode: string;
    }

    export class SamiCue {
        syncElement: HTMLElement;
        constructor(syncElement: HTMLElement) {
            if (syncElement.tagName.toLowerCase() !== "sync")
                throw new Error("SamiCue can only accept sync element");
            else
                this.syncElement = syncElement;

        }

        filterByLanguageCode(lang: string) {
            var newsync = <HTMLElement>this.syncElement.cloneNode(true);
            Array.prototype.filter.call(this.syncElement.children, (child: Node) => {
                if (child.nodeType == 1) {
                    var langData = <string>(<HTMLElement>child).dataset["language"];
                    if (!langData || langData === lang)
                        newsync.appendChild(child.cloneNode(true));
                }
                else
                    newsync.appendChild(child.cloneNode());
            });
            return newsync;
        }
    }

    export class SamiDocument {
        samiCues: SamiCue[] = [];
        languages: string[] = [];

        static parse(samistr: string): SamiDocument {
            var samiDocument = new SamiDocument();

            var bodystart = HTMLTagFinder.FindStartTag('body', samistr);
            var bodyendindex = this.lastIndexOfInsensitive(samistr, "</body>");

            var samicontainer = <Element>new DOMParser().parseFromString(
                (samistr.slice(0, bodystart.endPosition) + samistr.slice(bodyendindex))
                    .replace(/(<\/?)(\w+)[^<]+>/g, function (word) { return word.toLowerCase() }), "text/xml").firstChild;
            var samihead = <Element>samicontainer.getElementsByTagName("head")[0];

            var stylestr = '';
            Array.prototype.forEach.call(samihead.getElementsByTagName("style")[0].childNodes, (text: Text) => {
                if (text.data) stylestr += text.data;
            });
            var languageDeclarations = this.extractClassSelectors(stylestr);

            var samistyle = <CSSStyleSheet>new DOMParser().parseFromString("<style>" + stylestr + "</style>", "text/html").head.getElementsByTagName("style")[0].sheet;

            var samibody = samistr.slice(bodystart.endPosition, bodyendindex);

            var syncs = HTMLTagFinder.FindStartTags('sync', samibody);
            for (var i = 0; i < syncs.length - 1; i++)
                syncs[i].element.innerHTML = syncs[i].element.dataset['original-string'] = samibody.slice(syncs[i].endPosition, syncs[i + 1].startPosition);
            if (i > 0)
                syncs[i].element.innerHTML = syncs[i].element.dataset['original-string'] = samibody.slice(syncs[i].endPosition, bodyendindex);

            var cues: SamiCue[] = [];
            syncs.forEach((sync) => {
                cues.push(new SamiCue(this.fixIncorrectRubyNodes(sync.element)));
            });
            cues.forEach((cue: SamiCue) => {
                this.giveLanguageData(cue, languageDeclarations);
            });

            var languageNames: string[] = [];
            languageDeclarations.forEach((value: SamiLanguage) => {
                languageNames.push(value.languageName);
            });

            return {
                samiCues: cues,
                languages: languageNames
            }
        }

        private static giveLanguageData(cue: SamiCue, languages: SamiLanguage[]) {
            Array.prototype.filter.call(cue.syncElement.children, (child: Node) => {
                for (var i = 0; i < languages.length; i++) {
                    if (child.nodeType == 1) {
                        var classCode = <string>(<HTMLElement>child).className;
                        if (!classCode || classCode === languages[i].className)
                            (<HTMLElement>child).dataset['language'] = languages[i].languageName;
                    }
                }
            });
        }

        private static extractClassSelectors(stylestr: string) {
            var classes = stylestr.replace(/\s/g, "").match(/\.\w+{[^{]+}/g);
            var languages: SamiLanguage[] = [];
            classes.forEach((classstr) => {
                var classselector = classstr.match(/\.\w+{/);
                if (classselector.length != 1)
                    return;
                var stylebody = classstr.slice(classselector[0].length).split(';');
                var name: string;
                var lang: string;
                for (var i = 0; i < stylebody.length; i++) {
                    var stylename = stylebody[i].match(/\w+:/);
                    if (stylename.length == 1) {
                        var stylevalue = stylebody[i].slice(stylename[0].length);
                        if (!name && stylename[0].toLowerCase() === "name:")
                            name = stylevalue;
                        else if (!lang && stylename[0].toLowerCase() === "lang:")
                            lang = stylevalue;
                        if (name && lang)
                            break;
                    }
                }

                if (name && lang)
                    languages.push({
                        className: classselector[0].slice(1, classselector[0].length - 1),
                        languageName: name,
                        languageCode: lang
                    });
            });
            return languages;
        }

        private static fixIncorrectRubyNodes(syncobject: HTMLElement) {
            var rubylist = syncobject.getElementsByTagName("ruby");
            var rtlist = rubylist.length > 0 ? syncobject.getElementsByTagName("rt") : undefined;
            if (!rtlist || rtlist.length == 0)
                return syncobject;

            //rt가 ruby 바깥에 있거나 rt가 비어 있는 것을 체크. 해당 조건에 맞으면 font 태그를 모두 제거한 뒤 파싱, 그 뒤에 font를 다시 적용한다
            if (!this.isRubyParentExist(rtlist[0]) || rtlist[0].textContent.length == 0) {
                var fontdeleted = this.exchangeFontWithTemp(syncobject);
                var fontextracted = this.extractFontAndText(syncobject);
                var textsFromNoFont = this.extractReadableTextNodes(fontdeleted);
                var textsFromOnlyFont = this.extractReadableTextNodes(fontextracted);
                for (var i = 0; i < textsFromOnlyFont.length; i++) {
                    var font = this.getFontFromNode(textsFromOnlyFont[i]);
                    if (font) 
                        this.wrapWith(textsFromNoFont[i], font);
                }

                return this.fixIncorrectRPs(fontdeleted);
            }
            else
                return syncobject;
        }

        private static fixIncorrectRPs(syncobject: HTMLElement) {
            var newsync = <HTMLElement>syncobject.cloneNode(true);
            Array.prototype.forEach.call(newsync.getElementsByTagName("ruby"), (ruby: HTMLElement) => {
                var rt = ruby.getElementsByTagName("rt")[0];
                if (rt && rt.innerHTML.length == 0 && rt !== ruby.childNodes[ruby.childNodes.length - 1]) {
                    var rtdetected = false;
                    var i = 0;
                    while (i < ruby.childNodes.length) {
                        var innernode = ruby.childNodes[i];
                        if (rtdetected === false) {
                            if (innernode.nodeType == 1 && (<HTMLElement>innernode).tagName.toLowerCase() === "rt") {
                                rtdetected = true;
                                i++;
                                continue;
                            }
                            i++;
                        }
                        else {
                            ruby.removeChild(innernode);
                            rt.appendChild(innernode);
                        }
                    }
                }
            });
            return newsync;
        }
        //private static deleteRPs(syncobject: HTMLElement) {
        //    var newsync = <HTMLElement>syncobject.cloneNode(false);
        //    var newsyncstr = <string>newsync.dataset['original-string'];
        //    HTMLTagFinder.FindStartTags('rp', newsyncstr).reverse().forEach((fonttag: FoundHTMLTag) => {
        //        newsyncstr = newsyncstr.slice(0, fonttag.startPosition) + newsyncstr.slice(fonttag.endPosition);
        //    });
        //    newsync.dataset['original-string'] = newsyncstr.replace(/<\/rp>/g, '');
        //    return newsync;
        //}

        private static wrapWith(targetNode: Node, newParentNode: Node) {
            var currentParentNode = targetNode.parentNode;//shall have one
            var currentNextSibling = targetNode.nextSibling;
            currentParentNode.removeChild(targetNode);
            newParentNode.appendChild(targetNode);//will be inserted end of the list when .nextSibling is null
            currentParentNode.insertBefore(newParentNode, currentNextSibling);
        }

        private static isRubyParentExist(rtelement: HTMLElement) {
            if (rtelement.parentElement) {
                if (rtelement.parentElement.tagName.toLowerCase() === "ruby")
                    return true;
                else
                    return this.isRubyParentExist(rtelement.parentElement);
            }
            else
                return false;
        }

        private static getFontFromNode(text: Node): HTMLElement {
            if (text.parentNode) {
                var parent = <HTMLElement>text.parentNode;
                if (parent.tagName.toLowerCase() === "font") {
                    if ((<HTMLElement>parent).getAttribute("color"))
                        return <HTMLElement>parent.cloneNode(false);
                }
                return this.getFontFromNode(parent);
            }
            else
                return null;
        }

        private static exchangeFontWithTemp(syncobject: HTMLElement) {//<temp /> will be ignored by parsers
            var newsync = <HTMLElement>syncobject.cloneNode(false);
            var newsyncstr = <string>newsync.dataset['original-string'];
            HTMLTagFinder.FindStartTags('font', newsyncstr).reverse().forEach((fonttag: FoundHTMLTag) => {
                newsyncstr = newsyncstr.slice(0, fonttag.startPosition) + "<temp />" + newsyncstr.slice(fonttag.endPosition);
            });
            newsync.innerHTML = newsyncstr.replace(/<\/font>/g, '');
            return newsync;
        }

        private static extractFontAndText(syncobject: HTMLElement) {
            var newsync = <HTMLElement>syncobject.cloneNode(false);
            var newsyncstr = <string>newsync.dataset['original-string'];
            var tags = HTMLTagFinder.FindAllStartTags(syncobject.dataset['original-string']);
            tags.filter((foundtag: SamiTS.FoundHTMLTag) => {
                switch (foundtag.element.tagName.toLowerCase()) {
                    case "font":
                    case "p": return false;
                    default: return true;
                }
            }).reverse().forEach((foundtag: SamiTS.FoundHTMLTag) => {
                    newsyncstr = newsyncstr.slice(0, foundtag.startPosition) + newsyncstr.slice(foundtag.endPosition);
                });;
            newsyncstr.match(/<\/\w+>/g).forEach((foundendtag: string) => {
                if (foundendtag !== "</font>")
                    newsyncstr = newsyncstr.replace(foundendtag, '');
            });
            newsync.innerHTML = newsyncstr;
            return newsync;
        }

        private static extractReadableTextNodes(syncobject: HTMLElement) {
            var walker = document.createTreeWalker(syncobject, NodeFilter.SHOW_TEXT, null, false);
            var node: Text;
            var textNodes: Text[] = [];
            node = <Text>walker.nextNode();
            while (node) {
                if (node.nodeValue.trim().length > 0)
                    textNodes.push(node);
                node = <Text>walker.nextNode();
            }
            return textNodes;
        }

        private static lastIndexOfInsensitive(target: string, searchString: string, position = target.length - searchString.length) {
            if (!searchString)
                return -1;
            else if (searchString.length == 0)
                return 0;
            var lowersearch = searchString.toLowerCase();
            for (var i = Math.min(target.length - searchString.length, position); i >= 0; i--) {
                if ((<string>target[i]).toLowerCase() == lowersearch[0] && (target.slice(i, i + searchString.length).toLowerCase() == lowersearch))
                    return i;
            }
            return -1;
        }
    }
}