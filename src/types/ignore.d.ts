declare module 'ignore' {
    interface Ignore {
        add(patterns: string | string[]): this;
        ignores(pathname: string): boolean;
    }
    
    function ignore(): Ignore;
    
    export = ignore;
}
