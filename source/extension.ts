'use strict';
import * as vscode from 'vscode';
import * as vscel from '@wraith13/vscel';
//import packageJson from "../package.json";
import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";
const locale = vscel.locale.make(localeEn, { "ja": localeJa });
export module ZoomBar
{
    const applicationKey = "zoombar-vscode";
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
    const getConfiguration = <type = vscode.WorkspaceConfiguration>(key? : string, section : string = "zoombar") : type =>
    {
        const rawKey = undefined === key ? undefined: key.split(".").reverse()[0];
        const rawSection = undefined === key || rawKey === key ? section: `${section}.${key.replace(/(.*)\.[^\.]+/, "$1")}`;
        const configuration = vscode.workspace.getConfiguration(rawSection);
        return rawKey ?
            configuration[rawKey] :
            configuration;
    };
    const getZoomLevel = () : number => getConfiguration<number>("zoomLevel", "window") || 0.0;
    const setZoomLevel = (zoomLevel : number) : Thenable<void> => getConfiguration(undefined, "window").update("zoomLevel", zoomLevel, true);

    const getDefaultZoom = () : number => getConfiguration<number>("defaultZoom");
    const getZoomUnit = () : number => getConfiguration<number>("zoomUnit");
    const getZoomUnitLevel = () : number => percentToLevel(cent +getZoomUnit());
    const getZoomPreset = () : number[] => getConfiguration<number[]>("zoomPreset")
            .filter(distinctFilter)
            .sort((a,b) => b - a);
    const getZoomInLabelText = () : string => getConfiguration<string>("zoomInLabel");
    const getZoomOutLabelText = () : string => getConfiguration<string>("zoomOutLabel");
    const getFontZoomResetLabelText = () : string => getConfiguration<string>("fontZoomResetLabel");
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
                text: getZoomInLabelText(),
                command: `${applicationKey}.zoomIn`,
                tooltip: locale.map("zoombar-vscode.zoomIn.title")
            }),
            zoomOutLabel = vscel.statusbar.createItem
            ({
                alignment: vscode.StatusBarAlignment.Right,
                text: getZoomOutLabelText(),
                command: `${applicationKey}.zoomOut`,
                tooltip: locale.map("zoombar-vscode.zoomout.title")
            }),
            fontZoomResetLabel = vscel.statusbar.createItem
            ({
                alignment: vscode.StatusBarAlignment.Right,
                text: getFontZoomResetLabelText(),
                command: `editor.action.fontZoomReset`,
                tooltip: locale.map("zoombar-vscode.fontZoomReset.title")
            }),
            //  イベントリスナーの登録
            vscode.workspace.onDidChangeConfiguration(() => updateStatusBar())
        );
        updateStatusBar();
    };
    export const selectZoom = async () : Promise<void> =>
    {
        const currentZoom = roundZoom(levelToPercent(getZoomLevel()));
        await vscel.menu.showQuickPick
        (
            [
                {
                    label: `$(home) ${locale.map("zoombar-vscode.selectZoom.resetZoom")} ( ${percentToDisplayString(getDefaultZoom())} )`,
                    description: "",
                    command: async () => await setZoomLevel(percentToLevel(getDefaultZoom())),
                },
                {
                    label: `${getFontZoomResetLabelText()} ${locale.map("zoombar-vscode.fontZoomReset.title")}`,
                    description: "",
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
                            command: async (input) => await setZoomLevel(percentToLevel(parseFloat(input))),
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
                        command: async () => await setZoomLevel(percentToLevel(i)),
                    })
                )
            ),
            {
                placeHolder: locale.map("zoombar-vscode.selectZoom.placeHolder"),
            }
        );
    };
    export const resetZoom = () : Thenable<void> => setZoomLevel(percentToLevel(getDefaultZoom()));
    export const zoomOut = () : Thenable<void> => setZoomLevel(getZoomLevel() -getZoomUnitLevel());
    export const zoomIn = () : Thenable<void> => setZoomLevel(getZoomLevel() +getZoomUnitLevel());
    export const updateStatusBar = () : void =>
    {
        const uiDisplayOrder = getConfiguration<string>("uiDisplayOrder");
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
                        zoomInLabel.text = getZoomInLabelText();
                        zoomInLabel.show();
                        break;
                    case "-":
                        zoomOutLabel.text = getZoomOutLabelText();
                        zoomOutLabel.show();
                        break;
                    case "@":
                        fontZoomResetLabel.text = getFontZoomResetLabelText();
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
