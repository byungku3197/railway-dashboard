const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                if (line.includes('??') || line.includes('\uFFFD')) {
                    results.push(`${file}:${i + 1}: ${line.trim()}`);
                }
            });
        }
    });
    return results;
}

const corruptedFiles = walk('src');
console.log(JSON.stringify(corruptedFiles, null, 2));
