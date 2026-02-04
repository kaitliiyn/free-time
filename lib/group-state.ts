import { supabase, isSupabaseConfigured } from './supabase'

export interface GroupMember {
  userId: string
  userName: string
  joinedAt: number
}

export interface GroupData {
  code: string
  members: GroupMember[]
  createdAt: number
}

class GroupState {
  async getGroup(groupCode: string): Promise<GroupData | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase is not configured. Cannot fetch group.')
      return null
    }
    
    try {
      // Fetch group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('group_code', groupCode)
        .single()

      if (groupError || !group) {
        return null
      }

      // Fetch members
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select('*')
        .eq('group_code', groupCode)
        .order('joined_at', { ascending: true })

      if (membersError) {
        console.error('Error fetching members:', membersError)
        return null
      }

      return {
        code: group.group_code,
        members: (members || []).map((m) => ({
          userId: m.user_id,
          userName: m.user_name,
          joinedAt: new Date(m.joined_at).getTime(),
        })),
        createdAt: new Date(group.created_at).getTime(),
      }
    } catch (error) {
      console.error('Error getting group:', error)
      return null
    }
  }

  async createGroup(groupCode: string, userId: string, userName: string): Promise<GroupData | null> {
    if (!isSupabaseConfigured()) {
      console.error('Supabase is not configured. Cannot create group.')
      return null
    }
    
    try {
      // Create group
      const { error: groupError } = await supabase
        .from('groups')
        .insert({
          group_code: groupCode,
        })

      if (groupError) {
        console.error('Error creating group:', groupError)
        return null
      }

      // Add creator as first member
      const { error: memberError } = await supabase
        .from('members')
        .insert({
          group_code: groupCode,
          user_id: userId,
          user_name: userName,
        })

      if (memberError) {
        console.error('Error adding member:', memberError)
        return null
      }

      return await this.getGroup(groupCode)
    } catch (error) {
      console.error('Error creating group:', error)
      return null
    }
  }

  async joinGroup(groupCode: string, userId: string, userName: string): Promise<GroupData | null> {
    if (!isSupabaseConfigured()) {
      console.error('Supabase is not configured. Cannot join group.')
      return null
    }
    
    try {
      // Check if group exists
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('group_code', groupCode)
        .single()

      if (groupError || !group) {
        // Group doesn't exist, create it
        return await this.createGroup(groupCode, userId, userName)
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('members')
        .select('*')
        .eq('group_code', groupCode)
        .eq('user_id', userId)
        .single()

      if (existingMember) {
        // User is already a member
        return await this.getGroup(groupCode)
      }

      // Add new member
      const { error: memberError } = await supabase
        .from('members')
        .insert({
          group_code: groupCode,
          user_id: userId,
          user_name: userName,
        })

      if (memberError) {
        console.error('Error adding member:', memberError)
        return null
      }

      return await this.getGroup(groupCode)
    } catch (error) {
      console.error('Error joining group:', error)
      return null
    }
  }

  async getGroupMembers(groupCode: string): Promise<GroupMember[]> {
    try {
      const { data: members, error } = await supabase
        .from('members')
        .select('*')
        .eq('group_code', groupCode)
        .order('joined_at', { ascending: true })

      if (error) {
        console.error('Error fetching members:', error)
        return []
      }

      return (members || []).map((m) => ({
        userId: m.user_id,
        userName: m.user_name,
        joinedAt: new Date(m.joined_at).getTime(),
      }))
    } catch (error) {
      console.error('Error getting group members:', error)
      return []
    }
  }

  async updateMemberName(groupCode: string, userId: string, userName: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('members')
        .update({ user_name: userName })
        .eq('group_code', groupCode)
        .eq('user_id', userId)

      if (error) {
        console.error('Error updating member name:', error)
      }
    } catch (error) {
      console.error('Error updating member name:', error)
    }
  }

  // Subscribe to real-time updates for group members
  // Falls back to polling if Realtime is not available
  subscribeToMembers(
    groupCode: string,
    callback: (members: GroupMember[]) => void
  ) {
    if (!isSupabaseConfigured()) {
      // If Supabase not configured, just poll every 5 seconds
      const interval = setInterval(async () => {
        const members = await this.getGroupMembers(groupCode)
        callback(members)
      }, 5000)
      return () => clearInterval(interval)
    }

    try {
      const channel = supabase
        .channel(`members:${groupCode}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'members',
            filter: `group_code=eq.${groupCode}`,
          },
          async () => {
            const members = await this.getGroupMembers(groupCode)
            callback(members)
          }
        )
        .subscribe()

      // Also set up polling as fallback in case Realtime doesn't work
      const pollInterval = setInterval(async () => {
        const members = await this.getGroupMembers(groupCode)
        callback(members)
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
        const members = await this.getGroupMembers(groupCode)
        callback(members)
      }, 3000)
      return () => clearInterval(interval)
    }
  }
}

export const groupState = new GroupState()
