const fs = require('fs');
let content = fs.readFileSync('src/pages/DashboardHomePageV2.tsx', 'utf8');

// Remove BOM if present
if (content.startsWith('\uFEFF')) {
    content = content.slice(1);
}

// Replace corrupted patterns
// ?\u20AC or similar patterns
content = content.replace(/\?\u20AC/g, '팀');
content = content.replace(/\?€/g, '팀');

fs.writeFileSync('src/pages/DashboardHomePageV2.tsx', content, 'utf8');
console.log('Fixed character corruption in DashboardHomePageV2.tsx');
