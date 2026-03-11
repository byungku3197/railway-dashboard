const fs = require('fs');
const content = fs.readFileSync('src/pages/DashboardHomePageV2.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (/[^\x00-\x7F가-힣]/.test(line)) {
        console.log(`Line ${i + 1}: ${line}`);
    }
});
