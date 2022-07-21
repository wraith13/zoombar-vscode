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
    const configurationTargetObject = Object.freeze
    ({
        "auto": async () =>
            undefined !== Config.zoomLevel.inspect()?.workspaceValue ?
                {
                    scope: vscel.config.Scope.rootWorkspace,
                    target: vscode.ConfigurationTarget.Workspace,
                }:
                {
                    scope: vscel.config.Scope.user,
                    target: vscode.ConfigurationTarget.Global,
                },
        "global": async () =>
        {
            if (undefined !== Config.zoomLevel.inspect(vscel.config.Scope.rootWorkspace)?.workspaceValue)
            {
                await Config.zoomLevel.set
                (
                    undefined,
                    vscel.config.Scope.rootWorkspace,
                    vscode.ConfigurationTarget.Workspace
                );
            }
            const result =
            {
                scope: vscel.config.Scope.user,
                target: vscode.ConfigurationTarget.Global,
            };
            return result;
        },
        "workspace": async () =>
            (vscode.workspace.workspaceFolders?.length ?? 0) <= 0 ?
                {
                    scope: vscel.config.Scope.user,
                    target: vscode.ConfigurationTarget.Global,
                }:
                {
                    scope: vscel.config.Scope.rootWorkspace,
                    target: vscode.ConfigurationTarget.Workspace,
                },
    });
    module Config
    {
        export const root = vscel.config.makeRoot(packageJson);
        export const defaultZoom = root.makeEntry<number>("zoombar.defaultZoom", "root-workspace");
        export const zoomUnit = root.makeEntry<number>("zoombar.zoomUnit", "root-workspace");
        export const preview = root.makeEntry<boolean>("zoombar.preview", "root-workspace");
        export const zoomPreset = root.makeEntry<number[]>("zoombar.zoomPreset", "root-workspace");
        export const zoomInLabel = root.makeEntry<string>("zoombar.zoomInLabel", "root-workspace");
        export const zoomOutLabel = root.makeEntry<string>("zoombar.zoomOutLabel", "root-workspace");
        export const fontZoomResetLabel = root.makeEntry<string>("zoombar.fontZoomResetLabel", "root-workspace");
        export const uiDisplayOrder = root.makeEntry<string>("zoombar.uiDisplayOrder", "root-workspace");
        export const configurationTarget = root.makeMapEntry("zoombar.configurationTarget", "root-workspace", configurationTargetObject);
        export const zoomLevel = new vscel.config.Entry<number>({ key: "window.zoomLevel", });
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
    export const setZoomLevel = async (zoomLevel : number | InspectResult<number>, wait = 500) => new Promise<void>
    (
        async (resolve, rejct) =>
        {
            if (waitingSetZoomEntry)
            {
                clearTimeout(waitingSetZoomEntry.timer);
                waitingSetZoomEntry.rejct();
                waitingSetZoomEntry = undefined;
            }
            const timer: NodeJS.Timeout = <any>setTimeout // 本来、ここで any は要らないが、現状の webpack ベースのコンパイルではここでエラーになってしまう為。
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
                                    const context = await Config.configurationTarget.get()();
                                    await Config.zoomLevel.set
                                    (
                                        i.zoomLevel,
                                        context.scope,
                                        context.target
                                    );
                                }
                                else
                                {
                                    const inspectResult = <InspectResult<number>>i.zoomLevel;
                                    await Config.zoomLevel.set
                                    (
                                        inspectResult.globalValue,
                                        vscel.config.Scope.user,
                                        vscode.ConfigurationTarget.Global
                                    );
                                    await Config.zoomLevel.set
                                    (
                                        inspectResult.workspaceValue,
                                        vscel.config.Scope.rootWorkspace,
                                        vscode.ConfigurationTarget.Workspace
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
        ("number" === typeof waitingSetZoomEntry?.zoomLevel ? waitingSetZoomEntry?.zoomLevel: null) ??
        Config.zoomLevel.get() ??
        0.0;
    const getZoomUnitLevel = () : number => percentToLevel(cent +Config.zoomUnit.get());
    const getZoomPreset = () : number[] => Config.zoomPreset.get()
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
                text: Config.zoomInLabel.get(),
                command: `${applicationKey}.zoomIn`,
                tooltip: locale.map("zoombar-vscode.zoomIn.title")
            }),
            zoomOutLabel = vscel.statusbar.createItem
            ({
                alignment: vscode.StatusBarAlignment.Right,
                text: Config.zoomOutLabel.get(),
                command: `${applicationKey}.zoomOut`,
                tooltip: locale.map("zoombar-vscode.zoomout.title")
            }),
            fontZoomResetLabel = vscel.statusbar.createItem
            ({
                alignment: vscode.StatusBarAlignment.Right,
                text: Config.fontZoomResetLabel.get(),
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
                        updateStatusBar();
                    }
                }
            )
        );
        updateStatusBar();
    };
    export const selectZoom = async () : Promise<void> =>
    {
        const backup = Config.zoomLevel.inspect();
        const currentZoomLevel = getZoomLevel();
        const currentZoom = roundZoom(levelToPercent(currentZoomLevel));
        const preview = Config.preview.get();
        const rollback = async () => await setZoomLevel(backup);
        await vscel.menu.showQuickPick
        (
            [
                {
                    label: `$(home) ${locale.map("zoombar-vscode.selectZoom.resetZoom")} ( ${percentToDisplayString(Config.defaultZoom.get())} )`,
                    description: "",
                    preview: async () => await setZoomLevel(percentToLevel(Config.defaultZoom.get())),
                },
                {
                    label: `${Config.fontZoomResetLabel.get()} ${locale.map("zoombar-vscode.fontZoomReset.title")}`,
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
    export const resetZoom = () : Thenable<void> => setZoomLevel(percentToLevel(Config.defaultZoom.get()));
    export const zoomOut = () : Thenable<void> => setZoomLevel(getZoomLevel() -getZoomUnitLevel());
    export const zoomIn = () : Thenable<void> => setZoomLevel(getZoomLevel() +getZoomUnitLevel());
    export const updateStatusBar = () : void =>
    {
        const uiDisplayOrder = Config.uiDisplayOrder.get();
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
            // .reverse() Behavior changes with VS Code v1.36 or later.
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
                        zoomInLabel.text = Config.zoomInLabel.get();
                        zoomInLabel.show();
                        break;
                    case "-":
                        zoomOutLabel.text = Config.zoomOutLabel.get();
                        zoomOutLabel.show();
                        break;
                    case "@":
                        fontZoomResetLabel.text = Config.fontZoomResetLabel.get();
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
