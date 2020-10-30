'use strict';
import * as vscode from 'vscode';
import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";
interface LocaleEntry
{
    [key : string] : string;
}
const localeTableKey = <string>JSON.parse(<string>process.env.VSCODE_NLS_CONFIG).locale;
const localeTable = Object.assign
(
    localeEn,
    (
        (
            <{[key : string] : LocaleEntry}>
            {
                ja : localeJa
            }
        )
        [localeTableKey] || { }
    )
);
const localeString = (key : string) : string => localeTable[key] || key;
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
    const createStatusBarItem =
    (
        properties :
        {
            alignment ? : vscode.StatusBarAlignment,
            text ? : string,
            command ? : string,
            tooltip ? : string
        }
    )
    : vscode.StatusBarItem =>
    {
        const result = vscode.window.createStatusBarItem(properties.alignment);
        if (undefined !== properties.text)
        {
            result.text = properties.text;
        }
        if (undefined !== properties.command)
        {
            result.command = properties.command;
        }
        if (undefined !== properties.tooltip)
        {
            result.tooltip = properties.tooltip;
        }
        return result;
    }
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
            zoomLabel = createStatusBarItem
            ({
                alignment: vscode.StatusBarAlignment.Right,
                text: "zoom",
                command: `${applicationKey}.selectZoom`,
                tooltip: localeString("zoombar-vscode.selectZoom.title")
            }),
            zoomInLabel = createStatusBarItem
            ({
                alignment: vscode.StatusBarAlignment.Right,
                text: getZoomInLabelText(),
                command: `${applicationKey}.zoomIn`,
                tooltip: localeString("zoombar-vscode.zoomIn.title")
            }),
            zoomOutLabel = createStatusBarItem
            ({
                alignment: vscode.StatusBarAlignment.Right,
                text: getZoomOutLabelText(),
                command: `${applicationKey}.zoomOut`,
                tooltip: localeString("zoombar-vscode.zoomout.title")
            }),
            fontZoomResetLabel = createStatusBarItem
            ({
                alignment: vscode.StatusBarAlignment.Right,
                text: getFontZoomResetLabelText(),
                command: `editor.action.fontZoomReset`,
                tooltip: localeString("zoombar-vscode.fontZoomReset.title")
            }),
            //  イベントリスナーの登録
            vscode.workspace.onDidChangeConfiguration(() => updateStatusBar())
        );
        updateStatusBar();
    };
    export const selectZoom = async () : Promise<void> =>
    {
        const currentZoom = roundZoom(levelToPercent(getZoomLevel()));
        const select = await vscode.window.showQuickPick
        (
            [
                {
                    label: `$(home) ${localeString("zoombar-vscode.selectZoom.resetZoom")} ( ${percentToDisplayString(getDefaultZoom())} )`,
                    description: "",
                    value: getDefaultZoom().toString(),
                },
                {
                    label: `${getFontZoomResetLabelText()} ${localeString("zoombar-vscode.fontZoomReset.title")}`,
                    description: "",
                    value: "@",
                },
                {
                    label: `$(pencil) ${localeString("zoombar-vscode.selectZoom.inputZoom")}`,
                    description: "",
                    value: "*",
                }
            ]
            .concat
            (
                getZoomPreset().map
                (
                    i =>
                    ({
                        label: `$(text-size) ${percentToDisplayString(i)}`,
                        description: currentZoom === roundZoom(i) ? localeString("zoombar-vscode.selectZoom.current"): "",
                        value: i.toString()
                    })
                )
            ),
            {
                placeHolder: localeString("zoombar-vscode.selectZoom.placeHolder"),
            }
        );
        if (select)
        {
            if ("*" === select.value)
            {
                const zoom : any = await vscode.window.showInputBox
                ({
                    prompt: localeString("zoombar-vscode.inputZoom.placeHolder"),
                    value: currentZoom.toString(),
                });
                if (undefined !== zoom)
                {
                    await setZoomLevel(percentToLevel(parseFloat(zoom)));
                }
            }
            else
            if ("@" === select.value)
            {
                await vscode.commands.executeCommand(`editor.action.fontZoomReset`);
            }
            else
            {
                await setZoomLevel(percentToLevel(parseFloat(select.value)));
            }
        }
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
