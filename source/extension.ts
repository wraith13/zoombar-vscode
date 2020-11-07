'use strict';
import * as vscode from 'vscode';
import * as vscel from '@wraith13/vscel';
import packageJson from "../package.json";
import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";
const locale = vscel.locale.make(localeEn, { "ja": localeJa });
export module ZoomBar
{
    const applicationKey = "zoombar-vscode";
    const hasWokspaceZoomLevel = () =>
        undefined !== vscode.workspace.getConfiguration("window")
            .inspect("zoomLevel")
            ?.workspaceValue;
    const configurationTargetObject = Object.freeze
    ({
        "auto": async () =>
        {
            return ! hasWokspaceZoomLevel();
        },
        "global": async () =>
        {
            if (hasWokspaceZoomLevel())
            {
                await vscode.workspace.getConfiguration("window").update
                (
                    "zoomLevel",
                    undefined,
                    false
                );
            }
            return true;
        },
        "workspace": async () =>
        {
            return (vscode.workspace.workspaceFolders?.length ?? 0) <= 0;
        },
    });
    module Config
    {
        export const root = vscel.config.makeRoot(packageJson);
        export const defaultZoom = root.makeEntry<number>("zoombar.defaultZoom");
        export const zoomUnit = root.makeEntry<number>("zoombar.zoomUnit");
        export const preview = root.makeEntry<boolean>("zoombar.preview");
        export const zoomPreset = root.makeEntry<number[]>("zoombar.zoomPreset");
        export const zoomInLabel = root.makeEntry<string>("zoombar.zoomInLabel");
        export const zoomOutLabel = root.makeEntry<string>("zoombar.zoomOutLabel");
        export const fontZoomResetLabel = root.makeEntry<string>("zoombar.fontZoomResetLabel");
        export const uiDisplayOrder = root.makeEntry<string>("zoombar.uiDisplayOrder");
        export const configurationTarget = root.makeMapEntry("zoombar.configurationTarget", configurationTargetObject);
    }
    let previousUiDisplayOrder = "";
    let zoomLabel : vscode.StatusBarItem;
    let zoomOutLabel : vscode.StatusBarItem;
    let zoomInLabel : vscode.StatusBarItem;
    let fontZoomResetLabel : vscode.StatusBarItem;
    const cent = 100.0;
    const systemZoomUnit = 20.0;
    const systemZoomUnitRate = (systemZoomUnit + cent) / cent;
    const zoomLog = Math.log(systemZoomUnitRate);
    const distinctFilter = <type>(value : type, index : number, self : type[]) : boolean => index === self.indexOf(value);
    interface InspectResult<T>
    {
        //key: string;
        //defaultValue?: T;
        globalValue?: T;
        workspaceValue?: T;
        //workspaceFolderValue?: T;
        //defaultLanguageValue?: T;
        //globalLanguageValue?: T;
        //workspaceLanguageValue?: T;
        //workspaceFolderLanguageValue?: T;
        //languageIds?: string[];
    }
    interface SetZoomEntry
    {
        zoomLevel : number | InspectResult<number>;
        resolve: () => void;
        rejct: () => void;
        timer: NodeJS.Timeout;
    }
    let waitingSetZoomEntry: SetZoomEntry | undefined  = undefined;
    export const setZoomLevel = async (zoomLevel : number | InspectResult<number>, wait = 500) => new Promise
    (
        async (resolve, rejct) =>
        {
            if (waitingSetZoomEntry)
            {
                clearTimeout(waitingSetZoomEntry.timer);
                waitingSetZoomEntry.rejct();
                waitingSetZoomEntry = undefined;
            }
            const timer: NodeJS.Timeout = setTimeout
            (
                async () =>
                {
                    const i = waitingSetZoomEntry;
                    if (i)
                    {
                        waitingSetZoomEntry = undefined;
                        try
                        {
                            if (undefined !== i.zoomLevel)
                            {
                                if ("number" === typeof i.zoomLevel)
                                {
                                    await vscode.workspace.getConfiguration("window").update
                                    (
                                        "zoomLevel",
                                        i.zoomLevel,
                                        await Config.configurationTarget.get("")()
                                    );
                                }
                                else
                                {
                                    const inspectResult = <InspectResult<number>>i.zoomLevel;
                                    await vscode.workspace.getConfiguration("window").update
                                    (
                                        "zoomLevel",
                                        inspectResult.globalValue,
                                        true
                                    );
                                    await vscode.workspace.getConfiguration("window").update
                                    (
                                        "zoomLevel",
                                        inspectResult.workspaceValue,
                                        false
                                    );
                                }
                            }
                            i.resolve();
                        }
                        catch
                        {
                            i.rejct();
                        }
                    }
                },
                wait
            );
            waitingSetZoomEntry =
            {
                zoomLevel,
                resolve,
                rejct,
                timer,
            };
        }
    );
    const getZoomLevel = () : number =>
        waitingSetZoomEntry?.zoomLevel ??
        vscode.workspace.getConfiguration("window")["zoomLevel"] ??
        0.0;
    const getZoomUnitLevel = () : number => percentToLevel(cent +Config.zoomUnit.get(""));
    const getZoomPreset = () : number[] => Config.zoomPreset.get("")
            .filter(distinctFilter)
            .sort((a,b) => b - a);
    export const initialize = (context : vscode.ExtensionContext): void =>
    {
        context.subscriptions.push
        (
            //  コマンドの登録
            vscode.commands.registerCommand(`${applicationKey}.selectZoom`, selectZoom),
            vscode.commands.registerCommand(`${applicationKey}.resetZoom`, resetZoom),
            vscode.commands.registerCommand(`${applicationKey}.zoomIn`, zoomIn),
            vscode.commands.registerCommand(`${applicationKey}.zoomOut`, zoomOut),
            //  ステータスバーアイテムの登録
            zoomLabel = vscel.statusbar.createItem
            ({
                alignment: vscode.StatusBarAlignment.Right,
                text: "zoom",
                command: `${applicationKey}.selectZoom`,
                tooltip: locale.map("zoombar-vscode.selectZoom.title")
            }),
            zoomInLabel = vscel.statusbar.createItem
            ({
                alignment: vscode.StatusBarAlignment.Right,
                text: Config.zoomInLabel.get(""),
                command: `${applicationKey}.zoomIn`,
                tooltip: locale.map("zoombar-vscode.zoomIn.title")
            }),
            zoomOutLabel = vscel.statusbar.createItem
            ({
                alignment: vscode.StatusBarAlignment.Right,
                text: Config.zoomOutLabel.get(""),
                command: `${applicationKey}.zoomOut`,
                tooltip: locale.map("zoombar-vscode.zoomout.title")
            }),
            fontZoomResetLabel = vscel.statusbar.createItem
            ({
                alignment: vscode.StatusBarAlignment.Right,
                text: Config.fontZoomResetLabel.get(""),
                command: `editor.action.fontZoomReset`,
                tooltip: locale.map("zoombar-vscode.fontZoomReset.title")
            }),
            //  イベントリスナーの登録
            vscode.workspace.onDidChangeConfiguration
            (
                event =>
                {
                    if
                    (
                        event.affectsConfiguration("zoombar") ||
                        event.affectsConfiguration("window.zoomLevel")
                    )
                    {
                        Config.root.entries.forEach(i => i.clear());
                        updateStatusBar();
                    }
                }
            )
        );
        updateStatusBar();
    };
    export const selectZoom = async () : Promise<void> =>
    {
        const backup = <InspectResult<number>>vscode.workspace.getConfiguration("window").inspect("zoomLevel");
        const currentZoomLevel = getZoomLevel();
        const currentZoom = roundZoom(levelToPercent(currentZoomLevel));
        const preview = Config.preview.get("");
        const rollback = async () => await setZoomLevel(backup);
        await vscel.menu.showQuickPick
        (
            [
                {
                    label: `$(home) ${locale.map("zoombar-vscode.selectZoom.resetZoom")} ( ${percentToDisplayString(Config.defaultZoom.get(""))} )`,
                    description: "",
                    preview: async () => await setZoomLevel(percentToLevel(Config.defaultZoom.get(""))),
                },
                {
                    label: `${Config.fontZoomResetLabel.get("")} ${locale.map("zoombar-vscode.fontZoomReset.title")}`,
                    description: locale.map("No preview"),
                    command: async () => await vscode.commands.executeCommand(`editor.action.fontZoomReset`),
                },
                {
                    label: `$(pencil) ${locale.map("zoombar-vscode.selectZoom.inputZoom")}`,
                    description: "",
                    command: async () =>
                    {
                        vscel.menu.showInputBox
                        ({
                            prompt: locale.map("zoombar-vscode.inputZoom.placeHolder"),
                            value: currentZoom.toString(),
                            validateInput: input =>
                            {
                                const value = parseFloat(input);
                                if ( ! isFinite(value))
                                {
                                    return locale.map("Must be a number.");
                                }
                                const maxUnit = 4.0;
                                const min = 100 /maxUnit;
                                const max = 100 *maxUnit;
                                if ( ! (min <= value && value <= max))
                                {
                                    return `${locale.map("Range")}: ${min} - ${max}`;
                                }
                                return undefined;
                            },
                            preview,
                            command: async input => await setZoomLevel(percentToLevel(parseFloat(input))),
                            onCancel: rollback,
                        });
                    },
                }
            ]
            .concat
            (
                getZoomPreset().map
                (
                    i =>
                    ({
                        label: `$(text-size) ${percentToDisplayString(i)}`,
                        description: currentZoom === roundZoom(i) ? locale.map("zoombar-vscode.selectZoom.current"): "",
                        preview: async () => await setZoomLevel(percentToLevel(i)),
                    })
                )
            ),
            {
                placeHolder: locale.map("zoombar-vscode.selectZoom.placeHolder"),
                preview,
                rollback,
            }
        );
    };
    export const resetZoom = () : Thenable<void> => setZoomLevel(percentToLevel(Config.defaultZoom.get("")));
    export const zoomOut = () : Thenable<void> => setZoomLevel(getZoomLevel() -getZoomUnitLevel());
    export const zoomIn = () : Thenable<void> => setZoomLevel(getZoomLevel() +getZoomUnitLevel());
    export const updateStatusBar = () : void =>
    {
        const uiDisplayOrder = Config.uiDisplayOrder.get("");
        if (previousUiDisplayOrder !== uiDisplayOrder)
        {
            zoomLabel.hide();
            zoomInLabel.hide();
            zoomOutLabel.hide();
            fontZoomResetLabel.hide();
            previousUiDisplayOrder = uiDisplayOrder;
        }
        uiDisplayOrder
            .split("")
            .filter(distinctFilter)
            .reverse()
            .forEach
            (
                i =>
                {
                    switch(i)
                    {
                    case "%":
                        zoomLabel.text = percentToDisplayString(levelToPercent(getZoomLevel()));
                        zoomLabel.show();
                        break;
                    case "+":
                        zoomInLabel.text = Config.zoomInLabel.get("");
                        zoomInLabel.show();
                        break;
                    case "-":
                        zoomOutLabel.text = Config.zoomOutLabel.get("");
                        zoomOutLabel.show();
                        break;
                    case "@":
                        fontZoomResetLabel.text = Config.fontZoomResetLabel.get("");
                        fontZoomResetLabel.show();
                        break;
                    }
                }
            );
    };
    export const levelToPercent = (value : number) : number => Math.pow(systemZoomUnitRate, value) * cent;
    export const percentToLevel = (value : number) : number => Math.log(value / cent) / zoomLog;
    export const roundZoom = (value : number) : number => Math.round(value *cent) /cent;
    export const percentToDisplayString = (value : number, locales?: string | string[]) : string =>`${roundZoom(value / cent).toLocaleString(locales, { style: "percent" })}`;
}
export const activate = (context: vscode.ExtensionContext) : void => ZoomBar.initialize(context);
export const deactivate = () : void => { };
