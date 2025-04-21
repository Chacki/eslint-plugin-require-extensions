const { existsSync, lstatSync } = require('fs');
const { dirname, resolve } = require('path');

module.exports = {
  rules: {
    'require-extensions': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Относительные импорты/экспорты должны заканчиваться на .js (или .ts→.js/.tsx→.js)',
          category: 'ESM',
          recommended: true,
        },
        fixable: 'code',
        schema: [
          {
            type: 'object',
            properties: {
              extensions: {
                type: 'array',
                items: { type: 'string' },
                default: ['.js'],
              },
              extMapping: {
                type: 'object',
                additionalProperties: { type: 'string' },
                default: { '.ts': '.js', '.tsx': '.js' },
              },
            },
            additionalProperties: false,
          },
        ],
      },
      create(context) {
        const opts = context.options[0] || {};
        const extensions = opts.extensions || ['.js'];
        const extMapping = opts.extMapping || { '.ts': '.js', '.tsx': '.js' };

        function checkNode(node) {
          const source = node.source && node.source.value;
          if (!source) return;
          const raw = source.replace(/\?.*$/, ''); // убираем query
          if (!raw.startsWith('.') || extensions.some((e) => raw.endsWith(e))) {
            return;
          }

          const absPath = resolve(dirname(context.getFilename()), raw);
          for (const ext of extensions) {
            if (existsSync(absPath + ext)) {
              // найден .js-файл
              return context.report({
                node: node.source,
                message: 'Relative import/ export must end with {{ext}}',
                data: { ext },
                fix(fixer) {
                  return fixer.replaceText(node.source, `'${raw + ext}'`);
                },
              });
            }
          }
          for (const [from, to] of Object.entries(extMapping)) {
            if (raw.endsWith(from)) {
              const without = raw.slice(0, -from.length);
              const target = without + to;
              if (existsSync(resolve(dirname(context.getFilename()), target))) {
                return context.report({
                  node: node.source,
                  message: 'Change extension from {{from}} to {{to}}',
                  data: { from, to },
                  fix(fixer) {
                    return fixer.replaceText(node.source, `'${target}'`);
                  },
                });
              }
            }
          }
        }

        return {
          ImportDeclaration: checkNode,
          ExportNamedDeclaration: checkNode,
          ExportAllDeclaration: checkNode,
        };
      },
    },

    'require-index': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Directory imports must end with /index.js',
          category: 'ESM',
          recommended: true,
        },
        fixable: 'code',
        schema: [],
      },
      create(context) {
        function checkNode(node) {
          const source = node.source && node.source.value;
          if (!source) return;
          const raw = source.replace(/\?.*$/, '');
          if (!raw.startsWith('.')) return;

          const absPath = resolve(dirname(context.getFilename()), raw);
          if (existsSync(absPath) && lstatSync(absPath).isDirectory()) {
            return context.report({
              node: node.source,
              message: 'Directory imports must end with /index.js',
              fix(fixer) {
                return fixer.replaceText(node.source, `'${raw}/index.js'`);
              },
            });
          }
        }

        return {
          ImportDeclaration: checkNode,
          ExportNamedDeclaration: checkNode,
          ExportAllDeclaration: checkNode,
        };
      },
    },
  },

  configs: {
    recommended: {
      plugins: ['@chacki/require-extensions'],
      rules: {
        '@chacki/require-extensions/require-extensions': 'error',
        '@chacki/require-extensions/require-index': 'error',
      },
    },
  },
};
