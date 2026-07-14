import katex from 'katex';

try {
  console.log('Testing aisFormula...');
  const ais = "\\Delta_{\\text{AIS}} = 1 - \\left( \\sum_{i=1}^{4} w_i S_i \\right) \\times \\text{ZK}_{\\text{boost}}";
  katex.renderToString(ais);
  console.log('aisFormula OK!');
} catch (e) {
  console.error('aisFormula ERROR:', e.message);
}

try {
  console.log('Testing bccFormula...');
  const bcc = "\\rho_{\\text{BCC}} = \\frac{N_{\\text{blocked}}}{N_{\\text{total}}} \\times 100";
  katex.renderToString(bcc);
  console.log('bccFormula OK!');
} catch (e) {
  console.error('bccFormula ERROR:', e.message);
}

try {
  console.log('Testing inline...');
  const inline = "\\mathbf{5.0\\%}";
  katex.renderToString(inline);
  console.log('inline OK!');
} catch (e) {
  console.error('inline ERROR:', e.message);
}
