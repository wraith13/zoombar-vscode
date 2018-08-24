'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

export module ZoomBar
{
    var pass_through;
    var zoomLabel : vscode.StatusBarItem;
    var zoomOutLabel : vscode.StatusBarItem;
    var zoomInLabel : vscode.StatusBarItem;

    const systemZoomUnit = 20.0;
    const systemZoomUnitRate = (systemZoomUnit + 100.0) / 100.0;
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
        return percentToLevel(100.0 +getZoomUnit());
    }
    function getZoomPreset() : number[]
    {
        var result = getConfiguration<number[]>("zoomPreset");

        //  distinct
        result = result.filter(distinctFilter);

        //  sort
        result.sort((a,b) => b - a);

        return result;
    }
    function getZoomInLabelText() : string
    {
        return getConfiguration<string>("zoomInLabel");
    }
    function getZoomOutLabelText() : string
    {
        return getConfiguration<string>("zoomOutLabel");
    }

    export function registerCommand(context : vscode.ExtensionContext): void
    {
        console.log("zoombar.registerCommand();");
        context.subscriptions.push
        (
            vscode.commands.registerCommand
            (
                'zoombar-vscode.selectZoom', selectZoom
            )
        );
        context.subscriptions.push
        (
            vscode.commands.registerCommand
            (
                'zoombar-vscode.resetZoom', resetZoom
            )
        );
        context.subscriptions.push
        (
            vscode.commands.registerCommand
            (
                'zoombar-vscode.zoomIn', zoomIn
            )
        );
        context.subscriptions.push
        (
            vscode.commands.registerCommand
            (
                'zoombar-vscode.zoomOut', zoomOut
            )
        );

        zoomLabel = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        zoomLabel.text = "zoom";
        zoomLabel.command = "zoombar-vscode.selectZoom";
        zoomInLabel = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        zoomInLabel.text = getZoomInLabelText();
        zoomInLabel.command = "zoombar-vscode.zoomIn";
        zoomOutLabel = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        zoomOutLabel.text = getZoomOutLabelText();
        zoomOutLabel.command = "zoombar-vscode.zoomOut";

        context.subscriptions.push(zoomLabel);
        context.subscriptions.push(zoomInLabel);
        context.subscriptions.push(zoomOutLabel);

        vscode.workspace.onDidChangeConfiguration(() => updateIndicator());
        updateIndicator();
    }

    export async function selectZoom() : Promise<void>
    {
        console.log("zoombar.selectZoom();");
        const currentZoom = roundZoom(levelToPercent(getZoomLevel()));
        const preset = getZoomPreset();
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
            ].concat(
                preset.map
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
        console.log("zoombar.resetZoom();");
        setZoomLevel(percentToLevel(getDefaultZoom()));
    }
    export async function zoomOut() : Promise<void>
    {
        console.log("zoombar.zoomOut();");
        setZoomLevel(getZoomLevel() -getZoomUnitLevel());
    }
    export async function zoomIn() : Promise<void>
    {
        console.log("zoombar.zoomIn();");
        setZoomLevel(getZoomLevel() +getZoomUnitLevel());
    }
    export function updateIndicator() : void
    {
        var uiDisplayOrder = getConfiguration<string>("uiDisplayOrder");

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
                    case "+":
                        zoomInLabel.text = getZoomInLabelText();
                        zoomInLabel.show();
                        break;
                    case "%":
                        zoomLabel.text = percentToDisplayString(levelToPercent(getZoomLevel()));
                        zoomLabel.show();
                        break;
                    case "-":
                        zoomOutLabel.text = getZoomOutLabelText();
                        zoomOutLabel.show();
                        break;
                    }
                }
            );
        if (uiDisplayOrder.indexOf("+") < 0)
        {
            zoomInLabel.hide();
        }
        if (uiDisplayOrder.indexOf("%") < 0)
        {
            zoomLabel.hide();
        }
        if (uiDisplayOrder.indexOf("-") < 0)
        {
            zoomOutLabel.hide();
        }
    }

    export function levelToPercent(value : number) : number
    {
        return Math.pow(systemZoomUnitRate, value) * 100.0;
    }
    export function percentToLevel(value : number) : number
    {
        return Math.log(value / 100.0) / zoomLog;
    }
    export function roundZoom(value : number) : number
    {
        return Math.round(value *100.0) /100.0;
    }
    export function percentToDisplayString(value : number, locales?: string | string[]) : string
    {
        return `${roundZoom(value / 100.0).toLocaleString(locales, { style: "percent" })}`;
    }
}

export function activate(context: vscode.ExtensionContext) : void
{
    ZoomBar.registerCommand(context);
}

export function deactivate() : void
{
}