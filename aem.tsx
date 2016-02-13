import * as React from "react";
import * as component from "./ComponentManager";
import CqUtils from "./CqUtils";

interface CqWindow extends Window {
    CQ: any;
}

declare var window: CqWindow;

export class ResourceUtils {

    /**
     * returns only the properties of the given object whoe have a property named jcr:primaryType
     * @param resource the resource
     * @returns {any} the sub object
     */
    public static getChildren(resource: any): any {
        let children: any = {};
        Object.keys(resource).forEach((propertyName: string): void => {
            let child = resource[propertyName];
            if (child["jcr:primaryType"]) {
                children[propertyName] = child;
            }
        });
        return children;
    }

}


export interface AemProps {
    cqHidden?: boolean;
}

/**
 * Provides base functionality for components that are
 */
export class AemComponent<P extends AemProps, S> extends React.Component<P, S> {


    public static contextTypes: any = {
        wcmmode: React.PropTypes.string, path: React.PropTypes.string, resource: React.PropTypes.any
    };

    public context: {
        wcmmode: string;
        path: string;
        resource: any;
    };


    public getWcmmode(): string {
        return this.context.wcmmode;
    }

    public getPath(): string {
        return this.context.wcmmode;
    }

    public getResource(): any {
        return this.context.resource;
    }

    public isWcmEnabled(): boolean {
        return !this.getWcmmode() || this.getWcmmode() !== "disabled";
    }

    public isWcmEditable(): boolean {
        return ["disabled", "preview"].indexOf(this.getWcmmode()) < 0;
    }

    /**
     * change visibility of all nested react component roots.
     * @param path
     * @param visible
     */
    public setAllEditableVisible(path: string, visible: boolean): void {
        component.ComponentManager.INSTANCE.setNestedInstancesVisible(path, visible);
    }

}

export interface IncludeProps extends AemProps {
    path: string;
    resourceType: string;
    hidden?: boolean;
}


export class EditDialog extends AemComponent<IncludeProps, any> {

    public render(): React.ReactElement<any> {


        let script: string = "{{{edit-dialog \"" + this.props.path + "\" \"" + this.props.resourceType + "\"}}}";

        if (this.props.hidden) {
            CqUtils.setVisible(this.props.path, false, false);
        }

        return React.createElement("script", {
            // "data-always-hidden": this.props.hidden,
            hidden: !!this.props.hidden, dangerouslySetInnerHTML: {__html: script}
        });
    }


}


export interface Resource {
    "sling:resourceType": string;
}

export interface ResourceProps<C> extends AemProps {
    resource?: C;
    component?: string;
    path: string;
    root?: boolean;
    wcmmode?: string;
}


/**
 * Provides base functionality for components that are
 */
export abstract class ResourceComponent<C extends Resource, P extends ResourceProps<any>, S> extends AemComponent<P, S> {


    public getChildContext(): any {
        return {
            resource: this.getResource(),
            wcmmode: this.props.wcmmode || this.context.wcmmode,
            path: this.getPath()
        };

    }

    public static childContextTypes: any = {
        wcmmode: React.PropTypes.string, path: React.PropTypes.string, resource: React.PropTypes.any
    };


    public getWcmmode(): string {
        return this.props.wcmmode || this.context.wcmmode;
    }

    public getPath(): string {
        if (this.context.path && this.props.path) {
            return this.context.path + "/" + this.props.path;
        } else if (this.props.path) {
            return this.props.path;
        } else {
            return this.context.path;
        }

    }

    public componentDidMount(): void {
        component.ComponentManager.INSTANCE.addComponent(this);
    }


    public render(): React.ReactElement<any> {
        if (this.isWcmEditable() && this.props.root !== true) {
            let editDialog: React.ReactElement<any> = this.props.root ? null : (
                <EditDialog path={this.getPath()} resourceType={this.getResourceType()}/>);
            return (
                <div>
                    {this.renderBody()}
                    {editDialog}
                </div>
            );
        } else {
            return this.renderBody();
        }
    }

    public abstract renderBody(): React.ReactElement<any>;

    public getChildren(): any {
        let resource = this.props.resource;
        let children: any = {};
        Object.keys(resource).forEach((propertyName: string): void => {
            let child = resource[propertyName];
            if (child["jcr:primaryType"]) {
                children[propertyName] = child;
            }
        });
        return children;
    }

    public getResource(): C {
        return this.props.resource || this.context.resource[this.props.path];
    }

    public getResourceType(): string {
        return this.getResource()["sling:resourceType"];
    }

    public createNewChildNodeNames(prefix: String, count: number): string[] {
        let newNodeNames: string[] = [];
        let existingNodeNames: string[] = Object.keys(this.getChildren());

        for (let idx: number = 0; idx < count; idx++) {
            let nodeName: string = null;
            let index: number = idx;
            while (nodeName === null || existingNodeNames.indexOf(nodeName) >= 0) {
                nodeName = prefix + "_" + (index++);
            }
            newNodeNames.push(nodeName);
            existingNodeNames.push(nodeName);
        }
        return newNodeNames;
    }

}


export interface ScriptProps extends AemProps {
    js: string;
}

export class Script extends AemComponent<ScriptProps, any> {
    public render(): React.ReactElement<any> {
        return React.createElement("script", {dangerouslySetInnerHTML: {__html: this.props.js}});
    }
}

export interface CqEditProps extends AemProps {
    path: string;
    resourceType: string;
    dialog?: string;
    editConfig?: any;
}

export declare type WcmModeListener = (wcmmode: string) => void;

export class CqEdit extends AemComponent<CqEditProps, any> {

    public render(): React.ReactElement<any> {
        if (this.getWcmmode() === "disabled") {
            return null;
        } else {
            let dialog = this.props.dialog || "/apps/" + this.props.resourceType + "/dialog";
            let json = {
                "path": this.props.path, "dialog": dialog, "type": this.props.resourceType, editConfig: this.props.editConfig

            };

            let js: string = "CQ.WCM.edit(" + JSON.stringify(json) + ");";
            return <Script js={js}/>;
        }
    }

}


export class Cq {
    public static on(event: string, cb: WcmModeListener, ctx: any): void {
        if (typeof window !== "undefined" && window.CQ) {
            window.CQ.WCM.getTopWindow().CQ.WCM.on(event, cb, this);
        }
    }

    public static register(component: AemComponent<any, any>): void {
        let cb = function (wcmmode: string): void {
            // TODO use rendere
            component.props.wcmmode = wcmmode;
            component.forceUpdate();
        }.bind(this);
        Cq.on("wcmmodechange", cb, null);

    }

}

export interface EditMarkerProps extends AemProps {
    label?: string;
}

export class EditMarker extends AemComponent<EditMarkerProps, any> {
    public render(): React.ReactElement<any> {
        if (this.getWcmmode() === "edit") {
            return <h3 className="placeholder">{this.props.label}</h3>;
        } else {
            return null;
        }
    }
}
