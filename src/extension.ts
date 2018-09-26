'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

export module ZoomBar
{
    let pass_through;
    
    const applicationKey = "zoombar-vscode";

    let zoomLabel : vscode.StatusBarItem;
    let zoomOutLabel : vscode.StatusBarItem;
    let zoomInLabel : vscode.StatusBarItem;

    const cent = 100.0;
    const systemZoomUnit = 20.0;
    const systemZoomUnitRate = (systemZoomUnit + cent) / cent;
    const zoomLog = Math.log(systemZoomUnitRate);

    function distinctFilter<type>(value : type, index : number, self : type[]) : boolean
    {
        return index === self.indexOf(value);
    }

    function getConfiguration<type>(key? : string, section : string = "zoombar") : type
    {
        const configuration = vscode.workspace.getConfiguration(section);
        return key ?
            configuration[key] :
            configuration;
    }
    function getZoomLevel() : number
    {
        return getConfiguration<number>("zoomLevel", "window") || 0.0;
    }
    function setZoomLevel(zoomLevel : number) : void
    {
        vscode.workspace.getConfiguration("window").update("zoomLevel", zoomLevel, true);
    }
    function getDefaultZoom() : number
    {
        return getConfiguration<number>("defaultZoom");
    }
    function getZoomUnit() : number
    {
        return getConfiguration<number>("zoomUnit");
    }
    function getZoomUnitLevel() : number
    {
        return percentToLevel(cent +getZoomUnit());
    }
    function getZoomPreset() : number[]
    {
        return getConfiguration<number[]>("zoomPreset")
            .filter(distinctFilter)
            .sort((a,b) => b - a);
    }
    function getZoomInLabelText() : string
    {
        return getConfiguration<string>("zoomInLabel");
    }
    function getZoomOutLabelText() : string
    {
        return getConfiguration<string>("zoomOutLabel");
    }

    function createStatusBarItem
    (
        properties :
        {
            alignment ? : vscode.StatusBarAlignment,
            text ? : string,
            command ? : string,
            tooltip ? : string
        }
    )
    : vscode.StatusBarItem
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

    export function initialize(context : vscode.ExtensionContext): void
    {
        [
            //  コマンドの登録
            vscode.commands.registerCommand(`${applicationKey}.selectZoom`, selectZoom),
            vscode.commands.registerCommand(`${applicationKey}.resetZoom`, resetZoom),
            vscode.commands.registerCommand(`${applicationKey}.zoomIn`, zoomIn),
            vscode.commands.registerCommand(`${applicationKey}.zoomOut`, zoomOut),

            //  ステータスバーアイテムの登録
            zoomLabel = createStatusBarItem
            (
                {
                    alignment: vscode.StatusBarAlignment.Right,
                    text: "zoom",
                    command: `${applicationKey}.selectZoom`
                }
            ),
            zoomInLabel = createStatusBarItem
            (
                {
                    alignment: vscode.StatusBarAlignment.Right,
                    text: getZoomInLabelText(),
                    command: `${applicationKey}.zoomIn`
                }
            ),
            zoomOutLabel = createStatusBarItem
            (
                {
                    alignment: vscode.StatusBarAlignment.Right,
                    text: getZoomOutLabelText(),
                    command: `${applicationKey}.zoomOut`
                }
            ),

            //  イベントリスナーの登録
            vscode.workspace.onDidChangeConfiguration(() => updateStatusBar())
        ]
        .forEach(i => context.subscriptions.push(i));

        updateStatusBar();
    }

    export async function selectZoom() : Promise<void>
    {
        const currentZoom = roundZoom(levelToPercent(getZoomLevel()));
        const select = await vscode.window.showQuickPick
        (
            [
                {
                    label: `Reset zoom`,
                    description: "",
                    detail: getDefaultZoom().toString(),
                },
                {
                    label: `Input zoom`,
                    description: "",
                    detail: "*",
                }
            ]
            .concat
            (
                getZoomPreset().map
                (
                    i => pass_through =
                    {
                        label: percentToDisplayString(i),
                        description: currentZoom === roundZoom(i) ? "(current)": "",
                        detail: i.toString()
                    }
                )
            ),
            {
                placeHolder: "Select a zoom",
            }
        );
        if (select)
        {
            if ("*" === select.detail)
            {
                let zoom : any = await vscode.window.showInputBox
                (
                    {
                        prompt: "Input a zoom",
                        value: currentZoom.toString(),
                    }
                );
                if (undefined !== zoom)
                {
                    setZoomLevel(percentToLevel(parseFloat(zoom)));
                }
            }
            else
            {
                setZoomLevel(percentToLevel(parseFloat(select.detail)));
            }
        }
    }
    export async function resetZoom() : Promise<void>
    {
        setZoomLevel(percentToLevel(getDefaultZoom()));
    }
    export async function zoomOut() : Promise<void>
    {
        setZoomLevel(getZoomLevel() -getZoomUnitLevel());
    }
    export async function zoomIn() : Promise<void>
    {
        setZoomLevel(getZoomLevel() +getZoomUnitLevel());
    }
    export function updateStatusBar() : void
    {
        const uiDisplayOrder = getConfiguration<string>("uiDisplayOrder");

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
                    }
                }
            );
        if (uiDisplayOrder.indexOf("%") < 0)
        {
            zoomLabel.hide();
        }
        if (uiDisplayOrder.indexOf("+") < 0)
        {
            zoomInLabel.hide();
        }
        if (uiDisplayOrder.indexOf("-") < 0)
        {
            zoomOutLabel.hide();
        }
    }

    export function levelToPercent(value : number) : number
    {
        return Math.pow(systemZoomUnitRate, value) * cent;
    }
    export function percentToLevel(value : number) : number
    {
        return Math.log(value / cent) / zoomLog;
    }
    export function roundZoom(value : number) : number
    {
        return Math.round(value *cent) /cent;
    }
    export function percentToDisplayString(value : number, locales?: string | string[]) : string
    {
        return `${roundZoom(value / cent).toLocaleString(locales, { style: "percent" })}`;
    }
}

export function activate(context: vscode.ExtensionContext) : void
{
    ZoomBar.initialize(context);
}

export function deactivate() : void
{
}