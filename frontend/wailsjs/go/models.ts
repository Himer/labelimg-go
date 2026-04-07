export namespace main {
	
	export class ShapeJSON {
	    label: string;
	    points: number[][];
	    difficult: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ShapeJSON(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.points = source["points"];
	        this.difficult = source["difficult"];
	    }
	}
	export class AnnotationData {
	    shapes: ShapeJSON[];
	
	    static createFrom(source: any = {}) {
	        return new AnnotationData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.shapes = this.convertValues(source["shapes"], ShapeJSON);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FileInfo {
	    name: string;
	    path: string;
	    index: number;
	
	    static createFrom(source: any = {}) {
	        return new FileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.index = source["index"];
	    }
	}
	export class ImageData {
	    base64: string;
	    width: number;
	    height: number;
	    filename: string;
	    index: number;
	    total: number;
	    shapes: ShapeJSON[];
	    saveFormat: string;
	
	    static createFrom(source: any = {}) {
	        return new ImageData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.base64 = source["base64"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.filename = source["filename"];
	        this.index = source["index"];
	        this.total = source["total"];
	        this.shapes = this.convertValues(source["shapes"], ShapeJSON);
	        this.saveFormat = source["saveFormat"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

