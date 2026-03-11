try {
    const fs = require('fs');
    const content = fs.readFileSync('src/pages/DashboardHomePageV2.tsx', 'utf8');
    // We can't easily parse TSX in plain Node without babel/typescript,
    // but we can check for obvious things like unmatched braces.
    let braces = 0;
    let brackets = 0;
    let parens = 0;
    for (let char of content) {
        if (char === '{') braces++;
        if (char === '}') braces--;
        if (char === '[') brackets++;
        if (char === ']') brackets--;
        if (char === '(') parens++;
        if (char === ')') parens--;
    }
    console.log(`Braces: ${braces}, Brackets: ${brackets}, Parens: ${parens}`);
} catch (e) {
    console.error(e);
}
