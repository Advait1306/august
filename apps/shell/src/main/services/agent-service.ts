import { db } from '../db'
import { baseAgents, agents, agentMemories } from '../db/schema'
import type { BaseAgent, Agent, NewAgent, AgentMemory, NewAgentMemory } from '../db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export class AgentService {
  // Base Agents (hardcoded management)
  async seedBaseAgents(
    builtInAgents: Array<{ id: string; name: string; apiKey: string | null }>
  ): Promise<void> {
    try {
      for (const agent of builtInAgents) {
        // Use INSERT OR IGNORE to only add new base agents, not update existing ones
        await db
          .insert(baseAgents)
          .values({
            id: agent.id,
            name: agent.name,
            apiKey: agent.apiKey,
            isBuiltIn: true
          })
          .onConflictDoNothing()
      }
    } catch (error) {
      console.error('Failed to seed base agents:', error)
      throw error
    }
  }

  async getAllBaseAgents(): Promise<BaseAgent[]> {
    try {
      return await db.select().from(baseAgents).orderBy(baseAgents.name)
    } catch (error) {
      console.error('Failed to get base agents:', error)
      throw error
    }
  }

  async updateBaseAgentApiKey(id: string, apiKey: string): Promise<BaseAgent> {
    try {
      await db.update(baseAgents).set({ apiKey }).where(eq(baseAgents.id, id))

      const updated = await db.select().from(baseAgents).where(eq(baseAgents.id, id)).get()
      if (!updated) {
        throw new Error(`Base agent with id ${id} not found`)
      }
      return updated
    } catch (error) {
      console.error('Failed to update base agent API key:', error)
      throw error
    }
  }

  // Custom Agents (full CRUD)
  async getAllAgents(): Promise<Agent[]> {
    try {
      return await db.select().from(agents).orderBy(agents.name)
    } catch (error) {
      console.error('Failed to get agents:', error)
      throw error
    }
  }

  async createAgent(data: Omit<NewAgent, 'id'>): Promise<Agent> {
    try {
      const id = nanoid()
      const newAgent = { ...data, id }

      await db.insert(agents).values(newAgent)

      const created = await db.select().from(agents).where(eq(agents.id, id)).get()
      if (!created) {
        throw new Error('Failed to create agent')
      }
      return created
    } catch (error) {
      console.error('Failed to create agent:', error)
      throw error
    }
  }

  async getAgentWithMemories(
    id: string
  ): Promise<Agent & { memories: AgentMemory[]; baseAgent: BaseAgent }> {
    try {
      const agent = await db.select().from(agents).where(eq(agents.id, id)).get()
      if (!agent) {
        throw new Error(`Agent with id ${id} not found`)
      }

      const baseAgent = await db
        .select()
        .from(baseAgents)
        .where(eq(baseAgents.id, agent.baseAgentId))
        .get()
      if (!baseAgent) {
        throw new Error(`Base agent with id ${agent.baseAgentId} not found`)
      }

      const memories = await db
        .select()
        .from(agentMemories)
        .where(eq(agentMemories.agentId, id))
        .orderBy(agentMemories.createdAt)

      return {
        ...agent,
        memories,
        baseAgent
      }
    } catch (error) {
      console.error('Failed to get agent with memories:', error)
      throw error
    }
  }

  async updateAgent(id: string, data: Partial<Omit<Agent, 'id' | 'createdAt'>>): Promise<Agent> {
    try {
      await db.update(agents).set(data).where(eq(agents.id, id))

      const updated = await db.select().from(agents).where(eq(agents.id, id)).get()
      if (!updated) {
        throw new Error(`Agent with id ${id} not found`)
      }
      return updated
    } catch (error) {
      console.error('Failed to update agent:', error)
      throw error
    }
  }

  async deleteAgent(id: string): Promise<void> {
    try {
      const result = await db.delete(agents).where(eq(agents.id, id))
      if (result.changes === 0) {
        throw new Error(`Agent with id ${id} not found`)
      }
    } catch (error) {
      console.error('Failed to delete agent:', error)
      throw error
    }
  }

  // Memories (full CRUD)
  async getAgentMemories(agentId: string): Promise<AgentMemory[]> {
    try {
      return await db
        .select()
        .from(agentMemories)
        .where(eq(agentMemories.agentId, agentId))
        .orderBy(agentMemories.createdAt)
    } catch (error) {
      console.error('Failed to get agent memories:', error)
      throw error
    }
  }

  async addMemory(data: Omit<NewAgentMemory, 'id'>): Promise<AgentMemory> {
    try {
      const id = nanoid()
      const newMemory = { ...data, id }

      await db.insert(agentMemories).values(newMemory)

      const created = await db.select().from(agentMemories).where(eq(agentMemories.id, id)).get()
      if (!created) {
        throw new Error('Failed to create memory')
      }
      return created
    } catch (error) {
      console.error('Failed to add memory:', error)
      throw error
    }
  }

  async updateMemory(id: string, memory: string): Promise<AgentMemory> {
    try {
      await db.update(agentMemories).set({ memory }).where(eq(agentMemories.id, id))

      const updated = await db.select().from(agentMemories).where(eq(agentMemories.id, id)).get()
      if (!updated) {
        throw new Error(`Memory with id ${id} not found`)
      }
      return updated
    } catch (error) {
      console.error('Failed to update memory:', error)
      throw error
    }
  }

  async deleteMemory(id: string): Promise<void> {
    try {
      const result = await db.delete(agentMemories).where(eq(agentMemories.id, id))
      if (result.changes === 0) {
        throw new Error(`Memory with id ${id} not found`)
      }
    } catch (error) {
      console.error('Failed to delete memory:', error)
      throw error
    }
  }
}

export const agentService = new AgentService()
