import { supabase, isSupabaseConfigured } from './supabase'

export interface BusyBlock {
  id: string
  userId: string
  userName: string
  groupCode: string
  day: number // 0 = Monday, 6 = Sunday
  startHour: number // 0-23
  startMinute: number // 0-59
  endHour: number // 0-23
  endMinute: number // 0-59
  label: string
  recurring: boolean
}

class CalendarState {
  private mapScheduleToBlock(schedule: any): BusyBlock {
    return {
      id: schedule.id,
      userId: schedule.user_id,
      userName: schedule.user_name,
      groupCode: schedule.group_code,
      day: schedule.day,
      startHour: schedule.start_hour,
      startMinute: schedule.start_minute,
      endHour: schedule.end_hour,
      endMinute: schedule.end_minute,
      label: schedule.label,
      recurring: schedule.recurring,
    }
  }

  async getBlocks(groupCode: string): Promise<BusyBlock[]> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.')
      return []
    }
    
    try {
      const { data: schedules, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('group_code', groupCode)
        .order('day', { ascending: true })
        .order('start_hour', { ascending: true })
        .order('start_minute', { ascending: true })

      if (error) {
        console.error('Error fetching blocks:', error)
        return []
      }

      return (schedules || []).map((s) => this.mapScheduleToBlock(s))
    } catch (error) {
      console.error('Error getting blocks:', error)
      return []
    }
  }

  async getBlocksForWeek(groupCode: string, weekStart: Date): Promise<BusyBlock[]> {
    return await this.getBlocks(groupCode)
  }

  async addBlock(block: Omit<BusyBlock, "id">): Promise<BusyBlock | null> {
    try {
      const { data: schedule, error } = await supabase
        .from('schedules')
        .insert({
          group_code: block.groupCode,
          user_id: block.userId,
          user_name: block.userName,
          day: block.day,
          start_hour: block.startHour,
          start_minute: block.startMinute,
          end_hour: block.endHour,
          end_minute: block.endMinute,
          label: block.label || 'Busy',
          recurring: block.recurring || false,
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding block:', error)
        return null
      }

      return this.mapScheduleToBlock(schedule)
    } catch (error) {
      console.error('Error adding block:', error)
      return null
    }
  }

  async updateBlock(groupCode: string, id: string, updates: Partial<BusyBlock>): Promise<void> {
    if (!isSupabaseConfigured()) {
      console.error('Supabase is not configured. Cannot update block.')
      return
    }
    
    try {
      const updateData: any = {}
      
      if (updates.label !== undefined) updateData.label = updates.label
      if (updates.recurring !== undefined) updateData.recurring = updates.recurring
      if (updates.day !== undefined) updateData.day = updates.day
      if (updates.startHour !== undefined) updateData.start_hour = updates.startHour
      if (updates.startMinute !== undefined) updateData.start_minute = updates.startMinute
      if (updates.endHour !== undefined) updateData.end_hour = updates.endHour
      if (updates.endMinute !== undefined) updateData.end_minute = updates.endMinute

      const { error } = await supabase
        .from('schedules')
        .update(updateData)
        .eq('id', id)
        .eq('group_code', groupCode)

      if (error) {
        console.error('Error updating block:', error)
      }
    } catch (error) {
      console.error('Error updating block:', error)
    }
  }

  async removeBlock(groupCode: string, id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      console.error('Supabase is not configured. Cannot remove block.')
      return
    }
    
    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', id)
        .eq('group_code', groupCode)

      if (error) {
        console.error('Error removing block:', error)
      }
    } catch (error) {
      console.error('Error removing block:', error)
    }
  }

  async getBlocksByUser(groupCode: string, userId: string): Promise<BusyBlock[]> {
    try {
      const { data: schedules, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('group_code', groupCode)
        .eq('user_id', userId)
        .order('day', { ascending: true })
        .order('start_hour', { ascending: true })

      if (error) {
        console.error('Error fetching user blocks:', error)
        return []
      }

      return (schedules || []).map((s) => this.mapScheduleToBlock(s))
    } catch (error) {
      console.error('Error getting user blocks:', error)
      return []
    }
  }

  async getBlocksByGroup(groupCode: string): Promise<BusyBlock[]> {
    return await this.getBlocks(groupCode)
  }

  // Subscribe to real-time updates for schedules
  // Falls back to polling if Realtime is not available
  subscribeToSchedules(
    groupCode: string,
    callback: (blocks: BusyBlock[]) => void
  ) {
    if (!isSupabaseConfigured()) {
      // If Supabase not configured, just poll every 5 seconds
      const interval = setInterval(async () => {
        const blocks = await this.getBlocks(groupCode)
        callback(blocks)
      }, 5000)
      return () => clearInterval(interval)
    }

    try {
      const channel = supabase
        .channel(`schedules:${groupCode}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'schedules',
            filter: `group_code=eq.${groupCode}`,
          },
          async () => {
            const blocks = await this.getBlocks(groupCode)
            callback(blocks)
          }
        )
        .subscribe()

      // Also set up polling as fallback in case Realtime doesn't work
      const pollInterval = setInterval(async () => {
        const blocks = await this.getBlocks(groupCode)
        callback(blocks)
      }, 3000) // Poll every 3 seconds as backup

      return () => {
        try {
          supabase.removeChannel(channel)
        } catch (e) {
          // Ignore errors if channel doesn't exist
        }
        clearInterval(pollInterval)
      }
    } catch (error) {
      // If Realtime subscription fails, fall back to polling
      console.warn('Realtime subscription failed, using polling fallback:', error)
      const interval = setInterval(async () => {
        const blocks = await this.getBlocks(groupCode)
        callback(blocks)
      }, 3000)
      return () => clearInterval(interval)
    }
  }
}

export const calendarState = new CalendarState()
