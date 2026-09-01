import { createApp } from 'vue';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import App from './App.vue';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3000,
      refetchInterval: 5000,
    },
  },
});

createApp(App).use(VueQueryPlugin, { queryClient }).mount('#root');
