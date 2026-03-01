/* @refresh reload */
import { render } from 'solid-js/web';
import './styles/global.css';
import App from './components/App';

const root = document.getElementById('root');

if (root) {
  render(() => <App />, root);
}
