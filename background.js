"use strict";

const TST_ID = "treestyletab@piro.sakura.ne.jp";

const DEFAULT_SETTINGS = {
    saturation: 60,
    lightness: 70,
    colors: 15,
    activeSaturate: 120,
    activeBrightness: 120,
    activeBold: true,
    hoverSaturate: 110,
    hoverBrightness: 110,
    hosts: [
        {host: 'example.com', regexp: false, color: '#FF7700', disabled: true},
        {host: '.*\\.google\\..*', regexp: true, color: '#7171FF', disabled: true},
    ],
};

let ColoredTabs = {
    state: {
        'inited': false,
    },

    init() {
        browser.storage.sync.get().then(async function (settingsStored) {
            ColoredTabs.settings = {}
            Object.assign(ColoredTabs.settings, DEFAULT_SETTINGS, settingsStored);

            ColoredTabs.state = {
                'tabsHost': [],
                'tabsClass': [],
                'inited': false,
                // 'hash': {},
                'hash': new Map(),
                'cache_host_tabclass': new Map(),
            };
            // console.log(ColoredTabs.settings);

            if (ColoredTabs.settings.hosts) {
                ColoredTabs.settings.hosts.forEach(function (hostsItem) {
                    if (hostsItem.disabled !== true && hostsItem.color.length > 3) {
                        if (hostsItem.regexp === true) {
                            if (ColoredTabs.state.hostsRegexp === undefined) {
                                ColoredTabs.state.hostsRegexp = [];
                                ColoredTabs.state.hostsRegexpColor = [];
                            }
                            ColoredTabs.state.hostsRegexp.push(hostsItem.host);
                            ColoredTabs.state.hostsRegexpColor.push(hostsItem.color);
                        } else {
                            if (ColoredTabs.state.hostsMatch === undefined) {
                                ColoredTabs.state.hostsMatch = [];
                                ColoredTabs.state.hostsMatchColor = [];
                            }
                            ColoredTabs.state.hostsMatch.push(hostsItem.host);
                            ColoredTabs.state.hostsMatchColor.push(hostsItem.color);
                        }
                    }
                });
            }

            await ColoredTabs.colorizeAllTabs();
            browser.tabs.onUpdated.addListener(ColoredTabs.checkTabChanges);
            browser.tabs.onRemoved.addListener(ColoredTabs.removeTabInfo)
            //         browser.tabs.onCreated.addListener(ColoredTabs.handleCreated);

            // console.log(ColoredTabs.state);

            ColoredTabs.state.inited = true;
        });
    },

//     handleCreated(tab) {
    //console.log("handleCreated tab id " + tab.id + " tab url " + tab.url);
//       if(tab.url.indexOf('about:') === 0)
//         return;
//       let host = new URL(tab.url);
//       host = host.hostname.toString();
//       ColoredTabs.colorizeTab(tab.id, host);
//     },

    async checkTabChanges(tabId, changeInfo, tab) {
        console.log("checkTabChanges tab id " + tabId + " tab url " + tab.url);
        console.log(changeInfo);
        if (typeof changeInfo.url === 'undefined' || tab.url.indexOf('about:') === 0)
            return;
        const _host = new URL(changeInfo.url);
        let host = _host.hostname.toString();
        host = ColoredTabs.sanitizeHostStr(host);
        if (host !== ColoredTabs.state.tabsHost[tabId]) {
            ColoredTabs.state.tabsHost[tabId] = host;
            await ColoredTabs.colorizeTab(tabId, host);
        }
    },
    removeTabInfo(tabId, removeInfo) {
        console.log("removeTabInfo tab id " + tabId);
        delete ColoredTabs.state.tabsHost[tabId];
        delete ColoredTabs.state.tabsClass[tabId];
    },

    async colorizeAllTabs() {
        console.log('colorizeAllTabs() start');
        let css = `
tab-item.active tab-item-substance {filter: saturate(` + ColoredTabs.settings.activeSaturate + `%) brightness(` + ColoredTabs.settings.activeBrightness + `%);}
tab-item tab-item-substance:hover {filter: saturate(` + ColoredTabs.settings.hoverSaturate + `%) brightness(` + ColoredTabs.settings.hoverBrightness + `%);}`;

        if (ColoredTabs.settings.activeBold === true) {
            css += 'tab-item.active .label{font-weight:bold}';
        }

        for (let i = 0; i < 360; i += (360 / ColoredTabs.settings.colors)) {
            let hue = Math.round(i);
            css += `tab-item.coloredTabsHue` + hue + ` tab-item-substance {background-color: hsl(` + hue + `,` + ColoredTabs.settings.saturation + `%,` + ColoredTabs.settings.lightness + `%);}`;
        }

        if (ColoredTabs.state.hostsMatchColor !== undefined) {
            ColoredTabs.state.hostsMatchColor.forEach((element, index) => css += `tab-item.coloredTabsHostMatch` + index + ` tab-item-substance {background-color: ` + element + `;}`);
        }
        if (ColoredTabs.state.hostsRegexpColor !== undefined) {
            ColoredTabs.state.hostsRegexpColor.forEach((element, index) => css += `tab-item.coloredTabsHostRegexp` + index + ` tab-item-substance {background-color: ` + element + `;}`);
        }
        console.log(css);

        browser.runtime.sendMessage(TST_ID, {
            type: "register-self",
            style: css,
        });

        await browser.tabs.query({}).then(async function (tabs) {
            let limit = 100;
            for (const tab of tabs) {
                if (limit-- === 0) break;
                let host = new URL(tab.url);
                let host_str = host.hostname.toString();
                if (host_str === undefined || host_str.length === 0) {
                    host_str = "unknown"
                }
                if (tab.id % 10 === 0) {
                    console.log('colorize tab id ' + tab.id + ' host ' + host_str);
                }
                await ColoredTabs.colorizeTab(tab.id, host_str);
                host = null;
                host_str = null;
            }
            console.log('Finished coloring');
        }, onError);
    },

    getTabClass(_host) {
        const host = ColoredTabs.sanitizeHostStr(_host);

        const cached_value = ColoredTabs.state.cache_host_tabclass.get(host);
        if (cached_value !== undefined) {
            return cached_value;
        }

        let index = null;
        let tabClass;
        if ((ColoredTabs.state.hostsMatch !== undefined) && (index = ColoredTabs.state.hostsMatch.indexOf(host) > -1)) {
            // if there is a host-color relation specified
            tabClass = 'coloredTabsHostMatch' + ColoredTabs.state.hostsMatch.indexOf(host);
        } else if (ColoredTabs.state.hostsRegexp !== undefined) {
            // if there is a regexp host-color relation specified
            for (let i = 0; i < ColoredTabs.state.hostsRegexp.length; i++) {
                if (host.match(ColoredTabs.state.hostsRegexp[i])) {
                    tabClass = 'coloredTabsHostRegexp' + i;
                    break;
                }
            }
        } else {
            // calculate hue color for host
            tabClass = 'coloredTabsHue' + Math.round((ColoredTabs.hash(host) % ColoredTabs.settings.colors) * (360 / ColoredTabs.settings.colors));
        }
        ColoredTabs.state.cache_host_tabclass.set(host, tabClass);
        return tabClass;
    },

    // TODO can be async
    async colorizeTab(tabId, host) {
        let tabClass = this.getTabClass(host);

        // console.log("colorizeTab tabId " + tabId + ", host " + host + " hash " + ColoredTabs.hash(host) + " step " + (ColoredTabs.hash(host) % ColoredTabs.settings.colors) + " tabClass " + tabClass);

        // FIXME why sending here two commands one after another, adding, and removing state?
        if (ColoredTabs.state.tabsClass[tabId] !== tabClass) {
            await browser.runtime.sendMessage(TST_ID, {
                type: 'add-tab-state',
                tabs: [tabId],
                state: tabClass,
            });
            if (typeof ColoredTabs.state.tabsClass[tabId] !== undefined) {
                await browser.runtime.sendMessage(TST_ID, {
                    type: 'remove-tab-state',
                    tabs: [tabId],
                    state: ColoredTabs.state.tabsClass[tabId],
                });
            }
            ColoredTabs.state.tabsClass[tabId] = tabClass;
        }
    },

    sanitizeHostStr(_s) {
        if (typeof _s !== 'string' || tab.url.indexOf('about:') === 0) {
            return "unknown";
        }
        return _s.slice(0, 100);
    },

    hash(_s) {
        const s = ColoredTabs.sanitizeHostStr(_s)
        const cached_value = ColoredTabs.state.hash.get(s);
        if (cached_value !== undefined) {
            return cached_value;
        }
        let h = 0;
        for (let i = 0, h = 1; i < s.length; i++) {
            h = Math.imul(h + s.charCodeAt(i) | 0, 2654435761);
        }
        const result = (h ^ h >>> 17) >>> 0;
        ColoredTabs.state.hash.set(s, cached_value);
        return result;
    },

}

function onError(error) {
    console.log(`Error: ${error}`);
}

async function registerToTST() {
    try {
        const self = await browser.management.getSelf();
        await browser.runtime.sendMessage(TST_ID, {
            type: "register-self",
            name: self.id,
            listeningTypes: ["ready", "sidebar-show", "permissions-changed"],
        });
    } catch (e) {
        // Could not register
        console.log("Tree Style Tab extension needed for TST Colored Tabs, but can't be detected. Please install or enable it.")
        return false;
    }

    return true;
}

async function handleTSTMessage(message, sender) {
    if (sender.id !== TST_ID) {
        return;
    }
    console.log('handleTSTMessage ' + message.type);
    console.log(message);

    switch (message.type) {
        case "ready":
            // TODO worth trying again after a couple of seconds?
            await registerToTST();
            console.log('Got Ready, calling init');
            ColoredTabs.init();
            break;
        case "sidebar-show":
        /* fall-through */
        case "permissions-changed":
            if (ColoredTabs.state.inited !== true) {
                console.log('TST ready, initializing ColoredTabs');
                ColoredTabs.init();
            } else {
                console.log('ColoredTabs already inited, so call colorizeAllTabs');
                await ColoredTabs.colorizeAllTabs();
            }
            break;
        default:
            console.log('Unhandled message: ', message);
            break;
    }
}

// TODO is this really needed?
// registerToTST();
browser.runtime.onMessageExternal.addListener(handleTSTMessage);


/**
 * Connection closed, pending request to server0.conn0.webExtensionDescriptor334, type reload failed Request stack: request@resource://devtools/shared/protocol/Front.js:300:14 generateRequestMethods/</frontProto[name]@resource://devtools/shared/protocol/Front/FrontClassWithSpec.js:47:19 reloadTemporaryExtension/<@resource://devtools/client/aboutdebugging/src/actions/debug-targets.js:166:30
 */