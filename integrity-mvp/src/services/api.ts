export const api = {
    getMarketTasks: async () => {
        return [
            {
                task_id: 'task_001_mock',
                title: 'Data Inference SLA',
                reward_itk: 250,
                min_ais_required: 800,
                status: 'OPEN',
                creator_agent_id: '88d5ab08-156b-45cf-9b17-32e74a9f2690',
                created_at: new Date().toISOString(),
                description: 'Autonomous contract for Data Inference SLA'
            }
        ];
    },
    getBenchmarks: async () => {
        return [
            {
                model_name: 'Hermes 3',
                provider_name: 'NousResearch',
                simulated_ais: 950,
                stability_metric: 0.98,
                grounding_metric: 0.99
            },
            {
                model_name: 'Llama 3.1 70B',
                provider_name: 'Meta',
                simulated_ais: 910,
                stability_metric: 0.92,
                grounding_metric: 0.95
            }
        ];
    },
    fundTaskWithLoan: async (_data: any) => {
        return { task_id: 'task_' + Math.random().toString(16).substring(2, 10) };
    },
    createMarketTask: async (_data: any) => {
        return { task_id: 'task_' + Math.random().toString(16).substring(2, 10) };
    },
    bidOnTask: async (_data: any) => {
        return { success: true };
    },
    requestAudit: async (_address: string, _type: string) => {
        return { success: true };
    },
};
