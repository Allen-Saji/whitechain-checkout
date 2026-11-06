import './style.css';
if (location.pathname === '/' || location.pathname === '/index.html')
  import('./main.js');
else import('./app/index.js').then((module) => module.startProduct());
