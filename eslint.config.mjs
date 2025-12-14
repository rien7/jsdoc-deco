import typescriptEslint from "typescript-eslint"

export default [{
    files: ["**/*.ts"],
}, {
    plugins: {
        "@typescript-eslint": typescriptEslint.plugin,
    },

    languageOptions: {
        parser: typescriptEslint.parser,
        ecmaVersion: 2022,
        sourceType: "module",
    },

    rules: {
        "@typescript-eslint/naming-convention": ["warn", {
            selector: "import",
            format: ["camelCase", "PascalCase"],
        }],

        curly: ["warn", "multi-line"],
        eqeqeq: "warn",
        "no-throw-literal": "warn",
        semi: ["warn", "never"],
        "space-in-parens": ["warn", "never"],
        "array-bracket-spacing": ["warn", "never"],
        "object-curly-spacing": ["warn", "always"],
        "block-spacing": ["warn", "always"],
        "quote": ["warn", "single"]
    },
}]