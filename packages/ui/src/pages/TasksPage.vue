<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import NewTaskForm from '../components/NewTaskForm.vue';
import ScheduleCard from '../components/ScheduleCard.vue';
import ScheduleForm from '../components/ScheduleForm.vue';
import TaskCard from '../components/TaskCard.vue';
import DashboardSkeleton from '../components/skeleton/DashboardSkeleton.vue';
import { api } from '../lib/api';

const { data: tasks, isLoading } = useQuery({
  queryKey: ['tasks'],
  queryFn: api.tasks,
});

const { data: schedules, isLoading: schedulesLoading } = useQuery({
  queryKey: ['schedules'],
  queryFn: api.schedules,
});
</script>

<template>
  <div class="container">
    <header class="header fade-in">
      <h2 class="title">Tarefas</h2>
      <p class="subtitle">
        Fila de execução do agente — ou peça via chat para criar e verificar tarefas
      </p>
    </header>

    <section class="section fade-in delay">
      <NewTaskForm />
    </section>

    <section class="section fade-in delay2">
      <h3 class="section-title">Agendamentos recorrentes</h3>
      <ScheduleForm />
      <DashboardSkeleton v-if="schedulesLoading" />
      <div v-else-if="schedules && schedules.length > 0" class="list schedules">
        <ScheduleCard v-for="schedule in schedules" :key="schedule.id" :schedule="schedule" />
      </div>
      <p v-else class="empty small">Nenhum agendamento. Crie tarefas que rodam via cron.</p>
    </section>

    <section class="section fade-in delay3">
      <h3 class="section-title">Fila</h3>
      <DashboardSkeleton v-if="isLoading" />
      <div v-else-if="tasks && tasks.length > 0" class="list">
        <TaskCard v-for="task in tasks" :key="task.id" :task="task" />
      </div>
      <p v-else class="empty">Nenhuma tarefa ainda. Crie uma acima ou peça no chat.</p>
    </section>
  </div>
</template>

<style scoped>
.container {
  height: 100%;
  overflow-y: auto;
}
.header {
  padding: 20px 20px 12px;
}
.title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}
.section {
  padding: 0 20px 20px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 12px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.schedules {
  margin-top: 12px;
}
.empty {
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
  padding: 32px;
}
.empty.small {
  padding: 16px;
  font-size: 13px;
}
.fade-in {
  animation: fadeIn 0.35s var(--ease-out);
}
.delay {
  animation-delay: 0.05s;
  animation-fill-mode: both;
}
.delay2 {
  animation-delay: 0.1s;
  animation-fill-mode: both;
}
.delay3 {
  animation-delay: 0.15s;
  animation-fill-mode: both;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
