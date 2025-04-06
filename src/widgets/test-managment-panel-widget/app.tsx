import React, { memo, useEffect, useState, useCallback } from 'react';
import Toggle from '@jetbrains/ring-ui-built/components/toggle/toggle';

const host = await YTApp.register();

interface Tag {
  name: string;
  id: string;
}

interface Issue {
  summary: string;
  id: string;
  tags: Tag[];
}

interface Project {
  name: string;
  id: string;
  issues: Issue[];
}

const AppComponent: React.FunctionComponent = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tagId, setTagId] = useState<string | null>(null);
  const [checked, setChecked] = useState(new Map<string,boolean>);

  // Fetch all projects
  const fetchProjects = async () => {
    try {
      const response: Project[] = await host.fetchYouTrack('admin/projects', {
        query: { fields: ['id', 'name', 'issues(id,summary,tags(name,id))'] },
      });
      setProjects(response);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching projects:', error);
    }
  };


  // Create "Test Run" issue if it doesn't exist
  const createIssue = async (projectId: string) => {
    try {
      await host.fetchYouTrack('issues', {
        method: 'POST',
        body: { project: { id: projectId }, summary: 'Test Run' },
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error creating issue:', error);
    }
  };

  const checkOrCreateIssues = useCallback(async () => {
    try {
      const response: Project[] = await host.fetchYouTrack('admin/projects', {
        query: { fields: ['id', 'name', 'issues(id,summary,tags(name,id))'] },
      });
      const map = new Map<string,boolean>;
      for (const project of response) {
        if (!project.issues.some((issue) => issue.summary === 'Test Run')) {
          await createIssue(project.id);
          map.set(project.id, false);
        }else if(project.issues.some((issue) => issue.summary === 'Test Run' && issue.tags.some((tag) => tag.name === 'to-be-tested'))){
          map.set(project.id, true);
        }

      }
      setChecked(map);
      await fetchProjects();

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching projects:', error);
    }
  },[]);

  // Create or fetch "to-be-tested" tag
  const fetchOrCreateTag = useCallback(async () => {
    try {
      const tags: Tag[] = await host.fetchYouTrack('tags/', { query: { fields: ['id', 'name'] } });
      const existingTag = tags.find((tag) => tag.name === 'to-be-tested');

      if (existingTag) {
        setTagId(existingTag.id);
      } else {
        const newTag :Tag = await host.fetchYouTrack('tags', {
          method: 'POST',
          body: { name: 'to-be-tested' },
        });
        setTagId(newTag.id);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching or creating tag:', error);
    }
  }, []);

  // Toggle or untoogle tag on an issue
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>, projectId: string) => {
    if (!tagId) {
      // eslint-disable-next-line no-console
      console.warn('Tag ID is not set yet.');
      return;
    }

    const project = projects.find((p) => p.id === projectId);
    if (!project) {return;}

    const issue = project.issues.find((target) => target.summary === 'Test Run');
    if (!issue) {return;}

    const issueId = issue.id;
    const copy = new Map(checked);
    try {
      if (e.target.checked) {
        await host.fetchYouTrack(`issues/${issueId}/tags?fields=id,name`, {
          method: 'POST',
          body: { id: tagId },
        });
        copy.set(project.id, true);
      } else {
        await host.fetchYouTrack(`issues/${issueId}/tags/${tagId}`, { method: 'DELETE' });
        copy.set(project.id, false);
      }
      await fetchProjects(); // Refresh project list after tagging/untagging
      setChecked(copy);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error updating issue tag:', error);
    }
  };

  useEffect(() => {
    checkOrCreateIssues();
  }, [checkOrCreateIssues]);
  useEffect(() => {
    fetchOrCreateTag();
  }, [fetchOrCreateTag]);

  return (
      <div className="widget">
        <h1>Test Managment Panel</h1>
        <ul id="projects-list">
          {projects.map((project) => {
            return (
                <li key={project.id}>
                  <span className="text-container">{project.name}</span>
                  <Toggle className="toogle" id={project.id} onChange={(e) => handleChange(e, project.id)} defaultChecked={checked.get(project.id)} />
                </li>
            );
          })}
        </ul>
      </div>
  );
};

export const App = memo(AppComponent);